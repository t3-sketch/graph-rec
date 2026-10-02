from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import torch

from .model import SparcModel


@dataclass(frozen=True)
class CatalogItem:
    track_id: str
    features: tuple[float, ...]


@dataclass(frozen=True)
class Recommendation:
    track_id: str
    score: float


def validate_catalog(catalog: Iterable[CatalogItem], input_dim: int) -> list[CatalogItem]:
    items = list(catalog)
    if not items:
        raise ValueError("catalog cannot be empty")
    ids = [item.track_id for item in items]
    if any(not isinstance(item.track_id, str) or not item.track_id for item in items) or len(set(ids)) != len(ids):
        raise ValueError("catalog IDs must be unique non-empty strings")
    if any(len(item.features) != input_dim or not all(torch.isfinite(torch.tensor(item.features, dtype=torch.float32))) for item in items):
        raise ValueError("catalog features must be finite and have one width")
    return items


def _allocate_quota(probabilities: torch.Tensor, count: int, interest_ids: list[int]) -> list[int]:
    base = [1] * len(probabilities)
    remaining = count - len(base)
    if remaining <= 0:
        return base[:count]
    exact = probabilities.detach().cpu().tolist()
    raw = [value * remaining for value in exact]
    floors = [int(value) for value in raw]
    quota = [base[index] + floors[index] for index in range(len(base))]
    left = remaining - sum(floors)
    order = sorted(range(len(raw)), key=lambda index: (-(raw[index] - floors[index]), interest_ids[index]))
    for index in order[:left]:
        quota[index] += 1
    return quota


def recommend(
    model: SparcModel,
    history_features: torch.Tensor,
    history_mask: torch.Tensor,
    catalog: Iterable[CatalogItem],
    excluded_ids: set[str],
    limit: int,
) -> list[Recommendation]:
    items = validate_catalog(catalog, model.config.input_dim)
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 8:
        raise ValueError("limit must be an integer from 1 to 8")
    by_id = {item.track_id: item for item in items}
    if any(item_id not in by_id for item_id in excluded_ids):
        raise ValueError("excluded ID is not in catalog")
    eligible = [item for item in items if item.track_id not in excluded_ids]
    count = min(limit, len(eligible))
    if not count:
        return []
    with torch.inference_mode():
        _, interest_ids, probabilities, users = model.inference(history_features, history_mask)
        k_eff = min(interest_ids.shape[1], count)
        selected_ids = interest_ids[0, :k_eff].tolist()
        selected_probabilities = probabilities[0, :k_eff]
        selected_probabilities = selected_probabilities / selected_probabilities.sum()
        candidates = torch.tensor([item.features for item in eligible], dtype=torch.float32)
        candidate_z = model.encode_items(candidates)
        route_scores = users[0, :k_eff] @ candidate_z.T
        quota = _allocate_quota(selected_probabilities, count, selected_ids)
        selected: set[int] = set()
        for route, route_quota in enumerate(quota):
            ranked = sorted(range(len(eligible)), key=lambda index: (-float(route_scores[route, index]), eligible[index].track_id))
            selected.update(ranked[:route_quota])
        weighted = (selected_probabilities.unsqueeze(1) * route_scores).sum(dim=0)
        ranked_union = sorted(selected, key=lambda index: (-float(weighted[index]), eligible[index].track_id))
        if len(ranked_union) < count:
            for index in sorted(range(len(eligible)), key=lambda index: (-float(weighted[index]), eligible[index].track_id)):
                if index not in selected:
                    ranked_union.append(index)
                if len(ranked_union) == count:
                    break
        if any(not torch.isfinite(value) for value in weighted):
            raise ValueError("retrieval produced a non-finite score")
        return [Recommendation(eligible[index].track_id, float(weighted[index])) for index in ranked_union[:count]]


# ponytail: exact full-catalog inner products are O(catalog * interests); add ANN only after measured retrieval latency requires it.
