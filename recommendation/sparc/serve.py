from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from typing import Any
from urllib.parse import urlparse

import torch

from .model import SparcModel, config_from_dict
from .retrieval import CatalogItem, recommend, validate_catalog

MAX_BODY_BYTES = 64 * 1024
REQUEST_KEYS = {"schema_version", "artifact_id", "catalog_sha256", "current_track_id", "history_track_ids", "excluded_track_ids", "limit"}


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _json_no_duplicates(data: bytes) -> dict[str, Any]:
    def pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    value = json.loads(data.decode("utf-8"), object_pairs_hook=pairs, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f"invalid JSON constant: {value}")))
    if not isinstance(value, dict):
        raise ValueError("request must be a JSON object")
    return value


@dataclass(frozen=True)
class Artifact:
    model: SparcModel
    catalog: list[CatalogItem]
    artifact_id: str
    catalog_sha256: str


def load_artifact(directory: Path) -> Artifact:
    manifest_path = directory / "manifest.json"
    items_path = directory / "items.json"
    weights_path = directory / "weights.pt"
    manifest_bytes = manifest_path.read_bytes()
    manifest = _json_no_duplicates(manifest_bytes)
    if manifest.get("schema_version") != "sparc-artifact-1" or manifest.get("data_kind") != "synthetic":
        raise ValueError("unsupported artifact manifest")
    code = manifest.get("code")
    is_hash = lambda value: isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None
    if not isinstance(code, dict) or set(code) != {"commit", "dirty", "source_files"}:
        raise ValueError("artifact code provenance is missing or invalid")
    if code["commit"] is not None and (not isinstance(code["commit"], str) or re.fullmatch(r"[0-9a-f]{40}", code["commit"]) is None):
        raise ValueError("invalid artifact commit")
    if code["dirty"] is not None and type(code["dirty"]) is not bool:
        raise ValueError("invalid artifact dirty status")
    sources = code["source_files"]
    if not isinstance(sources, dict) or not sources or any(
        not isinstance(name, str) or not name.startswith("recommendation/sparc/")
        or ".." in name.split("/") or not is_hash(digest) for name, digest in sources.items()
    ) or not is_hash(manifest.get("training_inputs_sha256")):
        raise ValueError("invalid artifact source or training-input hashes")
    if manifest.get("items_sha256") != _sha256(items_path.read_bytes()) or manifest.get("weights_sha256") != _sha256(weights_path.read_bytes()):
        raise ValueError("artifact file hash mismatch")
    items = _json_no_duplicates(items_path.read_bytes())
    if items.get("schema_version") != "sparc-items-1" or not isinstance(items.get("items"), list):
        raise ValueError("invalid artifact items")
    config = config_from_dict(manifest["config"])
    catalog = validate_catalog([CatalogItem(row["track_id"], tuple(float(value) for value in row["features"])) for row in items["items"]], config.input_dim)
    if manifest.get("served_catalog_sha256") != _sha256(items_path.read_bytes()):
        raise ValueError("served catalog hash mismatch")
    model = SparcModel(config)
    state = torch.load(weights_path, map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.eval()
    return Artifact(model, catalog, _sha256(manifest_bytes), _sha256(items_path.read_bytes()))


def _error(code: str, message: str) -> dict[str, dict[str, str]]:
    return {"error": {"code": code, "message": message}}


def _validate_request(value: dict[str, Any], artifact: Artifact) -> tuple[torch.Tensor, torch.Tensor, set[str], int]:
    if set(value) != REQUEST_KEYS:
        raise ValueError("request keys do not match sparc-request-1")
    if value["schema_version"] != "sparc-request-1":
        raise ValueError("unsupported request schema")
    if value["artifact_id"] != artifact.artifact_id:
        raise LookupError("artifact version mismatch")
    if value["catalog_sha256"] != artifact.catalog_sha256:
        raise LookupError("catalog version mismatch")
    if not isinstance(value["current_track_id"], str) or value["current_track_id"] not in {item.track_id for item in artifact.catalog}:
        raise ValueError("unknown current_track_id")
    history = value["history_track_ids"]
    excluded = value["excluded_track_ids"]
    limit = value["limit"]
    if not isinstance(history, list) or not all(isinstance(item_id, str) for item_id in history) or len(history) > 50:
        raise ValueError("invalid history_track_ids")
    if not history:
        raise RuntimeError("history is required")
    if not isinstance(excluded, list) or not all(isinstance(item_id, str) for item_id in excluded) or len(set(excluded)) != len(excluded):
        raise ValueError("invalid excluded_track_ids")
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 8:
        raise ValueError("limit must be an integer from 1 to 8")
    known = {item.track_id for item in artifact.catalog}
    if any(item_id not in known for item_id in [*history, *excluded]):
        raise ValueError("unknown track ID")
    by_id = {item.track_id: item for item in artifact.catalog}
    features = torch.tensor([by_id[item_id].features for item_id in history], dtype=torch.float32).unsqueeze(0)
    return features, torch.ones((1, len(history)), dtype=torch.bool), set(excluded) | {value["current_track_id"]}, limit


def build_server(artifact: Artifact, host: str = "127.0.0.1", port: int = 0, cors_origin: str | None = None) -> ThreadingHTTPServer:
    class Handler(BaseHTTPRequestHandler):
        server_version = "SparcLoopback/1"

        def _headers(self, status: int, length: int) -> None:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(length))
            origin = self.headers.get("Origin")
            if cors_origin and origin == cors_origin:
                self.send_header("Access-Control-Allow-Origin", cors_origin)
                self.send_header("Vary", "Origin")
            self.end_headers()

        def _write(self, status: int, value: dict[str, Any]) -> None:
            data = json.dumps(value, separators=(",", ":"), allow_nan=False).encode("utf-8")
            self._headers(status, len(data))
            self.wfile.write(data)

        def do_OPTIONS(self) -> None:
            if self.path != "/recommend" or not cors_origin or self.headers.get("Origin") != cors_origin:
                self._write(HTTPStatus.NOT_FOUND, _error("NOT_FOUND", "route not found"))
                return
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Access-Control-Allow-Origin", cors_origin)
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Vary", "Origin")
            self.end_headers()

        def do_POST(self) -> None:
            if self.path != "/recommend":
                self._write(HTTPStatus.NOT_FOUND, _error("NOT_FOUND", "route not found"))
                return
            length = self.headers.get("Content-Length")
            if length is None or not length.isdigit() or int(length) > MAX_BODY_BYTES:
                self._write(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, _error("BODY_TOO_LARGE", "request body exceeds 64 KiB"))
                return
            try:
                value = _json_no_duplicates(self.rfile.read(int(length)))
                history_features, history_mask, excluded, limit = _validate_request(value, artifact)
                recommendations = recommend(artifact.model, history_features, history_mask, artifact.catalog, excluded, limit)
                if len(recommendations) != min(limit, len(artifact.catalog) - len(excluded)):
                    raise RuntimeError("retrieval returned an unexpected count")
                self._write(HTTPStatus.OK, {"schema_version": "sparc-response-1", "artifact_id": artifact.artifact_id, "catalog_sha256": artifact.catalog_sha256, "recommendations": [{"track_id": row.track_id, "score": row.score} for row in recommendations]})
            except LookupError as error:
                self._write(HTTPStatus.CONFLICT, _error("ARTIFACT_MISMATCH" if "artifact" in str(error) else "CATALOG_MISMATCH", str(error)))
            except RuntimeError as error:
                self._write(HTTPStatus.UNPROCESSABLE_ENTITY if "history" in str(error) else HTTPStatus.INTERNAL_SERVER_ERROR, _error("HISTORY_REQUIRED" if "history" in str(error) else "INFERENCE_FAILED", str(error)))
            except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
                self._write(HTTPStatus.BAD_REQUEST, _error("INVALID_REQUEST", str(error)))

        def log_message(self, *_args: object) -> None:
            return

    return ThreadingHTTPServer((host, port), Handler)


def serve(directory: Path, port: int, cors_origin: str | None) -> None:
    artifact = load_artifact(directory)
    server = build_server(artifact, port=port, cors_origin=cors_origin)
    print(f"SPARC loopback server listening on http://{server.server_address[0]}:{server.server_address[1]}")
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve a local synthetic SPARC artifact")
    parser.add_argument("--artifact", required=True)
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--cors-origin")
    args = parser.parse_args()
    serve(Path(args.artifact), args.port, args.cors_origin)


if __name__ == "__main__":
    main()
