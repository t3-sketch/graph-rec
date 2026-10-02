from __future__ import annotations

import argparse
import hashlib
import json
import platform
import subprocess
from pathlib import Path
from typing import Any

import torch

from .model import SparcConfig, SparcModel
from .retrieval import CatalogItem, validate_catalog


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def _source_provenance() -> dict[str, Any]:
    root = Path(__file__).resolve().parents[2]
    sources = [f"recommendation/sparc/{name}" for name in (
        "__init__.py", "model.py", "train.py", "retrieval.py", "serve.py", "requirements.txt",
    )]
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True, stderr=subprocess.DEVNULL).strip()
        dirty = bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=root, text=True))
    except (OSError, subprocess.CalledProcessError):
        commit, dirty = None, None
    return {"commit": commit, "dirty": dirty, "source_files": {
        name: _sha256((root / name).read_bytes()) for name in sources
    }}


def _batch_sha256(batch: dict[str, torch.Tensor]) -> str:
    return _sha256(_json_bytes({key: value.detach().cpu().tolist() for key, value in batch.items()}))


def evaluate_smoke(model: SparcModel, batch: dict[str, torch.Tensor]) -> dict[str, float]:
    model.eval()
    with torch.inference_mode():
        _, _, probabilities, users = model.inference(batch["history_features"], batch["history_mask"])
        target_z = model.encode_items(batch["target_features"])
        scores = (probabilities * torch.einsum("bqd,bd->bq", users, target_z)).sum(dim=1)
        return {
            "bce": float(torch.nn.functional.binary_cross_entropy_with_logits(scores, batch["labels"])),
            "positive_margin": float(scores[batch["labels"] == 1].mean() - scores[batch["labels"] == 0].mean()),
        }


def make_smoke_data(config: SparcConfig) -> tuple[list[CatalogItem], dict[str, torch.Tensor]]:
    torch.manual_seed(config.seed)
    item_count = 32
    features = torch.zeros(item_count, config.input_dim)
    for index in range(item_count):
        cluster = index % 4
        features[index, cluster] = 1.0
        features[index, 4 + (index % max(1, config.input_dim - 4))] = (index // 4 + 1) / 8
    catalog = [CatalogItem(f"synthetic-{index:02d}", tuple(float(value) for value in features[index])) for index in range(item_count)]
    histories: list[tuple[int, int]] = []
    targets: list[int] = []
    labels: list[float] = []
    for cluster in range(4):
        histories.extend(([cluster, cluster + 4], [cluster, cluster + 4]))
        targets.extend((cluster + 8, ((cluster + 1) % 4) + 8))
        labels.extend((1.0, 0.0))
    history = torch.stack([features[[first, second]] for first, second in histories])
    target = features[targets]
    mask = torch.ones(history.shape[:2], dtype=torch.bool)
    return catalog, {
        "history_features": history,
        "history_mask": mask,
        "target_features": target,
        "target_ids": torch.tensor(targets, dtype=torch.long),
        "labels": torch.tensor(labels),
    }
def train_smoke(config: SparcConfig, steps: int = 200) -> tuple[SparcModel, list[CatalogItem], dict[str, Any]]:
    if type(steps) is not int or not 1 <= steps <= 200:
        raise ValueError("smoke steps must be an integer from 1 to 200")
    torch.set_num_threads(1)
    catalog, batch = make_smoke_data(config)
    provenance = {"code": _source_provenance(), "training_inputs_sha256": _batch_sha256(batch)}
    model = SparcModel(config)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    before = evaluate_smoke(model, batch)
    model.train()
    for _ in range(steps):
        optimizer.zero_grad(set_to_none=True)
        losses = model.compute_loss(batch)
        losses["total"].backward()
        optimizer.step()
    after = evaluate_smoke(model, batch)
    positive_margin = after["positive_margin"]
    if not after["bce"] < before["bce"]:
        raise RuntimeError(f"smoke BCE did not decrease: {before['bce']} -> {after['bce']}")
    if not positive_margin > max(0, before["positive_margin"]):
        raise RuntimeError(f"smoke inference margin did not improve: {before['positive_margin']} -> {positive_margin}")
    return model, catalog, {
        "before": before, "after": after, "positive_margin": positive_margin, "steps": steps,
        "losses": {key: float(value.detach()) for key, value in losses.items()},
        "provenance": provenance,
    }


def write_artifact(output: Path, model: SparcModel, catalog: list[CatalogItem], metrics: dict[str, Any], data_kind: str = "synthetic") -> str:
    if output.exists():
        raise FileExistsError(f"refusing to overwrite artifact directory: {output}")
    catalog = validate_catalog(catalog, model.config.input_dim)
    provenance = metrics["provenance"]
    output.mkdir(parents=True)
    items_value = {"schema_version": "sparc-items-1", "feature_version": "synthetic-v1", "items": [{"track_id": item.track_id, "features": list(item.features)} for item in catalog]}
    items_bytes = _json_bytes(items_value)
    (output / "items.json").write_bytes(items_bytes)
    torch.save(model.state_dict(), output / "weights.pt")
    weights_sha256 = _sha256((output / "weights.pt").read_bytes())
    manifest = {
        "schema_version": "sparc-artifact-1",
        "data_kind": data_kind,
        "feature_version": "synthetic-v1",
        "config": model.config.as_dict(),
        "dataset": {"id": "synthetic-sparc-smoke-v1", "sha256": _sha256(items_bytes)},
        "weights_sha256": weights_sha256,
        "items_sha256": _sha256(items_bytes),
        "served_catalog_sha256": _sha256(items_bytes),
        "metrics": metrics,
        "seed": model.config.seed,
        "environment": {"python": platform.python_version(), "torch": torch.__version__},
        "code": provenance["code"],
        "training_inputs_sha256": provenance["training_inputs_sha256"],
        "training": {"optimizer": "AdamW", "learning_rate": 1e-3, "steps": metrics["steps"]},
    }
    manifest_bytes = _json_bytes(manifest)
    (output / "manifest.json").write_bytes(manifest_bytes)
    return _sha256(manifest_bytes)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the synthetic SPARC smoke artifact")
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    if not args.smoke:
        raise SystemExit("only --smoke is implemented in S2; music training is S4")
    config = SparcConfig(input_dim=8, d_model=16, stages=3, codes=8, interests=2, lmax=50, seed=0)
    model, catalog, metrics = train_smoke(config)
    artifact_id = write_artifact(Path(args.output), model, catalog, metrics)
    print(json.dumps({"artifact_id": artifact_id, "metrics": metrics}, sort_keys=True))


if __name__ == "__main__":
    main()
