from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Mapping

import torch
from torch import Tensor, nn
from torch.nn import functional as F


@dataclass(frozen=True)
class SparcConfig:
    input_dim: int
    d_model: int = 64
    stages: int = 3
    codes: int = 64
    interests: int = 4
    lmax: int = 50
    beta: float = 0.25
    temperature: float = 0.1
    bpr_weight: float = 10.0
    seed: int = 0

    def validate(self) -> None:
        if any(value <= 0 for value in (self.input_dim, self.d_model, self.stages, self.codes, self.interests, self.lmax)):
            raise ValueError("SPARC dimensions must be positive")
        if self.interests > self.codes:
            raise ValueError("interests cannot exceed codes")
        if self.beta < 0 or self.temperature <= 0 or self.bpr_weight < 0:
            raise ValueError("invalid SPARC loss configuration")

    def as_dict(self) -> dict[str, int | float]:
        return asdict(self)


class SparcModel(nn.Module):
    def __init__(self, config: SparcConfig):
        super().__init__()
        config.validate()
        self.config = config
        self.item_tower = nn.Sequential(
            nn.Linear(config.input_dim, config.d_model),
            nn.ReLU(),
            nn.Linear(config.d_model, config.d_model),
        )
        self.position = nn.Embedding(config.lmax, config.d_model)
        self.history_attention = nn.MultiheadAttention(config.d_model, 1, batch_first=True)
        self.interest_tower = nn.Linear(config.d_model, config.codes)
        self.user_tower = nn.Sequential(
            nn.Linear(config.d_model * 2, config.d_model),
            nn.ReLU(),
            nn.Linear(config.d_model, config.d_model),
        )
        self.codebooks = nn.ParameterList([
            nn.Parameter(torch.randn(config.codes, config.d_model) * 0.02)
            for _ in range(config.stages)
        ])
        self._query_generator = torch.Generator(device="cpu").manual_seed(config.seed)

    def _check_features(self, features: Tensor, dimensions: int) -> None:
        if features.ndim != dimensions or features.shape[-1] != self.config.input_dim:
            raise ValueError(f"expected features with shape [..., {self.config.input_dim}]")
        if not torch.isfinite(features).all():
            raise ValueError("features must be finite")

    def encode_items(self, features: Tensor) -> Tensor:
        self._check_features(features, 2)
        return self.item_tower(features)

    def quantize(self, z: Tensor) -> tuple[Tensor, Tensor, Tensor, Tensor]:
        if z.ndim != 2 or z.shape[-1] != self.config.d_model:
            raise ValueError("quantize expects [batch, d_model]")
        if not torch.isfinite(z).all():
            raise ValueError("quantize input must be finite")
        residual = z
        indices: list[Tensor] = []
        codes: list[Tensor] = []
        rq = (z * 0).sum()
        for codebook in self.codebooks:
            distances = (
                residual.square().sum(dim=1, keepdim=True)
                - 2 * residual @ codebook.T
                + codebook.square().sum(dim=1).unsqueeze(0)
            )
            index = distances.argmin(dim=1)
            code = codebook[index]
            residual_before = residual
            indices.append(index)
            codes.append(code)
            rq = rq + (residual_before.detach() - code).square().sum(dim=1).mean() * self.config.beta
            residual = residual - code
        recon = z - residual
        rq = (z - recon).square().sum(dim=1).mean() + rq
        return torch.stack(indices, dim=1), torch.stack(codes, dim=1), recon, rq

    def encode_history(self, features: Tensor, mask: Tensor) -> Tensor:
        self._check_features(features, 3)
        if mask.ndim != 2 or mask.shape[:2] != features.shape[:2] or mask.dtype is not torch.bool:
            raise ValueError("history mask must be bool [batch, length]")
        if features.shape[1] > self.config.lmax:
            raise ValueError("history exceeds lmax")
        if not mask.any(dim=1).all():
            raise ValueError("history cannot be empty")
        batch, length, _ = features.shape
        positions = self.position(torch.arange(length, device=features.device)).unsqueeze(0)
        encoded = self.encode_items(features.reshape(batch * length, -1)).reshape(batch, length, -1)
        encoded = encoded + positions
        encoded, _ = self.history_attention(encoded, encoded, encoded, key_padding_mask=~mask, need_weights=False)
        return encoded.masked_fill(~mask.unsqueeze(-1), 0)

    def interest_logits(self, history: Tensor, mask: Tensor) -> Tensor:
        if history.ndim != 3 or mask.shape != history.shape[:2] or mask.dtype is not torch.bool:
            raise ValueError("invalid history tensor or mask")
        if not mask.any(dim=1).all():
            raise ValueError("history cannot be empty")
        pooled = history.sum(dim=1) / mask.sum(dim=1, keepdim=True).to(history.dtype)
        return self.interest_tower(pooled)

    def user_vectors(self, history: Tensor, mask: Tensor, queries: Tensor) -> Tensor:
        if history.ndim != 3 or queries.ndim != 3 or history.shape[0] != queries.shape[0]:
            raise ValueError("invalid user tower shapes")
        if history.shape[-1] != self.config.d_model or queries.shape[-1] != self.config.d_model:
            raise ValueError("invalid user tower width")
        if mask.shape != history.shape[:2] or mask.dtype is not torch.bool or not mask.any(dim=1).all():
            raise ValueError("invalid user tower mask")
        attention_logits = torch.einsum("bqd,bld->bql", queries, history) / self.config.d_model**0.5
        attention_logits = attention_logits.masked_fill(~mask.unsqueeze(1), torch.finfo(history.dtype).min)
        weights = F.softmax(attention_logits, dim=-1)
        attended = torch.einsum("bql,bld->bqd", weights, history)
        return self.user_tower(torch.cat((queries, attended), dim=-1))

    def _stable_interest_ids(self, logits: Tensor) -> Tensor:
        return logits.argsort(dim=-1, descending=True, stable=True)[:, : self.config.interests]

    def _training_queries(
        self,
        history: Tensor,
        mask: Tensor,
        target_e0: Tensor,
        target_recon: Tensor,
    ) -> Tensor:
        choose_recon = torch.rand((history.shape[0], 1), generator=self._query_generator).to(history.device) < 0.5
        query = torch.where(choose_recon, target_recon, target_e0)
        return self.user_vectors(history, mask, query.unsqueeze(1))[:, 0]

    def inference(self, features: Tensor, mask: Tensor) -> tuple[Tensor, Tensor, Tensor, Tensor]:
        history = self.encode_history(features, mask)
        logits = self.interest_logits(history, mask)
        interest_ids = self._stable_interest_ids(logits)
        probabilities = F.softmax(logits.gather(1, interest_ids), dim=-1)
        queries = self.codebooks[0][interest_ids]
        users = self.user_vectors(history, mask, queries)
        return logits, interest_ids, probabilities, users

    @staticmethod
    def _zero(reference: Tensor) -> Tensor:
        return reference.sum() * 0

    def _contrastive(self, left: Tensor, right: Tensor, ids: Tensor) -> tuple[Tensor, int]:
        if left.shape[0] < 2:
            return self._zero(left), left.shape[0]
        logits = left @ right.T / self.config.temperature
        row_losses: list[Tensor] = []
        skipped = 0
        row_ids = torch.arange(left.shape[0], device=left.device)
        for row in range(left.shape[0]):
            valid = (ids != ids[row]) | (row_ids == row)
            if int(valid.sum()) <= 1:
                skipped += 1
                continue
            row_logits = logits[row].masked_fill(~valid, torch.finfo(logits.dtype).min).unsqueeze(0)
            row_losses.append(F.cross_entropy(row_logits, torch.tensor([row], dtype=torch.long, device=left.device)))
        return (torch.stack(row_losses).mean() if row_losses else self._zero(left)), skipped

    def compute_loss(self, batch: Mapping[str, Tensor]) -> dict[str, Tensor]:
        history_features = batch["history_features"].float()
        history_mask = batch["history_mask"]
        target_features = batch["target_features"].float()
        labels = batch["labels"].float()
        if labels.ndim != 1 or target_features.ndim != 2 or history_features.shape[0] != labels.shape[0] or target_features.shape[0] != labels.shape[0]:
            raise ValueError("inconsistent loss batch")
        history = self.encode_history(history_features, history_mask)
        logits = self.interest_logits(history, history_mask)
        target_z = self.encode_items(target_features)
        target_indices, target_codes, target_recon, rq_loss = self.quantize(target_z)
        users = self._training_queries(history, history_mask, target_codes[:, 0], target_recon)
        relevance = (users * target_z).sum(dim=1)
        bce = F.binary_cross_entropy_with_logits(relevance, labels)

        positive = labels == 1
        bpr_terms: list[Tensor] = []
        bpr_skipped = 0
        positive_rows = torch.where(positive)[0].tolist()
        for row in positive_rows:
            alternate = next((candidate for candidate in positive_rows if int(target_indices[candidate, 0]) != int(target_indices[row, 0])), None)
            if alternate is None:
                bpr_skipped += 1
                continue
            positive_user = self.user_vectors(history[row : row + 1], history_mask[row : row + 1], target_codes[row : row + 1, 0:1])[:, 0]
            negative_user = self.user_vectors(history[row : row + 1], history_mask[row : row + 1], target_codes[alternate : alternate + 1, 0:1])[:, 0]
            positive_score = (positive_user * target_z[row]).sum()
            negative_score = (negative_user * target_z[row]).sum()
            bpr_terms.append(F.softplus(-(positive_score - negative_score)))
        bpr = torch.stack(bpr_terms).mean() if bpr_terms else self._zero(target_z)

        positive_rows_tensor = torch.where(positive)[0]
        if positive_rows_tensor.numel():
            ui_users = users[positive_rows_tensor]
            ui_recon = target_recon[positive_rows_tensor]
            positive_ids = batch.get("target_ids", positive_rows_tensor).long()[positive_rows_tensor] if "target_ids" in batch else positive_rows_tensor
            ui, ui_skipped = self._contrastive(ui_users, ui_recon, positive_ids)
            ii, ii_skipped = self._contrastive(target_z[positive_rows_tensor], ui_recon, positive_ids)
            interest_ce = F.cross_entropy(logits[positive_rows_tensor], target_indices[positive_rows_tensor, 0].detach())
        else:
            ui = self._zero(target_z)
            ii = self._zero(target_z)
            ui_skipped = ii_skipped = 0
            interest_ce = self._zero(target_z)

        total = bce + self.config.bpr_weight * bpr + interest_ce + ui + ii + rq_loss
        return {
            "total": total,
            "bce": bce,
            "rq": rq_loss,
            "shuffle_bpr": bpr,
            "ui_contrastive": ui,
            "ii_contrastive": ii,
            "interest_ce": interest_ce,
            "bpr_skipped": torch.tensor(float(bpr_skipped), device=target_z.device),
            "ui_skipped": torch.tensor(float(ui_skipped), device=target_z.device),
            "ii_skipped": torch.tensor(float(ii_skipped), device=target_z.device),
        }


def config_from_dict(values: Mapping[str, object]) -> SparcConfig:
    allowed = set(SparcConfig.__dataclass_fields__)
    if set(values) != allowed:
        raise ValueError("artifact config keys do not match SparcConfig")
    config = SparcConfig(**values)  # type: ignore[arg-type]
    config.validate()
    return config
