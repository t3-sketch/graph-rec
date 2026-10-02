from __future__ import annotations

import json
import hashlib
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import torch

from recommendation.sparc.model import SparcConfig, SparcModel
from recommendation.sparc.retrieval import CatalogItem, recommend, _allocate_quota
from recommendation.sparc.serve import build_server, load_artifact
from recommendation.sparc.train import make_smoke_data, train_smoke, write_artifact, _batch_sha256


class SparcModelTest(unittest.TestCase):
    def setUp(self) -> None:
        torch.manual_seed(0)
        self.config = SparcConfig(input_dim=8, d_model=16, stages=3, codes=8, interests=2, lmax=5, seed=0)
        self.model = SparcModel(self.config)
        self.features = torch.randn(4, 3, 8)
        self.mask = torch.tensor([[True, True, False], [True, True, True], [True, False, False], [True, True, False]])
        self.batch = {
            "history_features": self.features,
            "history_mask": self.mask,
            "target_features": torch.randn(4, 8),
            "target_ids": torch.tensor([1, 2, 3, 4]),
            "labels": torch.tensor([1.0, 1.0, 0.0, 1.0]),
        }

    def test_shapes_padding_losses_and_recommendation_gradient(self) -> None:
        history = self.model.encode_history(self.features, self.mask)
        self.assertEqual(tuple(history.shape), (4, 3, 16))
        self.assertTrue(torch.equal(history[0, 2], torch.zeros(16)))
        padded_changed = self.features.clone()
        padded_changed[0, 2] = 999
        self.assertTrue(torch.allclose(history[0], self.model.encode_history(padded_changed, self.mask)[0]))
        self.assertRaises(ValueError, self.model.encode_history, self.features, torch.zeros_like(self.mask))
        losses = self.model.compute_loss(self.batch)
        for name in ("bce", "rq", "shuffle_bpr", "ui_contrastive", "ii_contrastive", "interest_ce", "total"):
            self.assertIn(name, losses)
            self.assertTrue(torch.isfinite(losses[name]), name)
        self.model.zero_grad(set_to_none=True)
        recommendation_loss = losses["total"] - losses["rq"]
        recommendation_loss.backward()
        with torch.no_grad():
            codes, _, _, _ = self.model.quantize(self.model.encode_items(self.batch["target_features"]))
        selected = self.model.codebooks[0].grad[codes[:, 0].unique()]
        self.assertTrue(torch.isfinite(selected).all())
        self.assertGreater(float(selected.abs().sum()), 0.0)

    def test_contrastive_uses_diagonal_and_masks_duplicate_negatives(self) -> None:
        identity = torch.eye(3, requires_grad=True)
        actual, skipped = self.model._contrastive(identity, identity, torch.arange(3))
        expected = torch.nn.functional.cross_entropy(identity @ identity.T / self.config.temperature, torch.arange(3))
        self.assertTrue(torch.allclose(actual, expected))
        self.assertLess(float(actual.detach()), 0.001)
        self.assertEqual(skipped, 0)
        actual.backward()
        self.assertTrue(torch.isfinite(identity.grad).all())
        duplicate_loss, skipped = self.model._contrastive(identity, identity, torch.tensor([1, 1, 2]))
        self.assertLess(float(duplicate_loss.detach()), 0.001)
        self.assertEqual(skipped, 0)
        zero, skipped = self.model._contrastive(identity, identity, torch.ones(3, dtype=torch.long))
        self.assertEqual(float(zero.detach()), 0)
        self.assertEqual(skipped, 3)
        misaligned, _ = self.model._contrastive(identity, identity.roll(1, dims=0), torch.arange(3))
        self.assertGreater(float(misaligned.detach()), float(actual.detach()))

    def test_bce_uses_one_target_query_without_predicted_interest_weights(self) -> None:
        history = self.model.encode_history(self.features, self.mask)
        z = self.model.encode_items(self.batch["target_features"])
        _, codes, recon, _ = self.model.quantize(z)
        choose = torch.rand((4, 1), generator=torch.Generator().manual_seed(self.config.seed)) < 0.5
        query = torch.where(choose, recon, codes[:, 0])
        user = self.model.user_vectors(history, self.mask, query.unsqueeze(1))[:, 0]
        expected = torch.nn.functional.binary_cross_entropy_with_logits((user * z).sum(1), self.batch["labels"])
        actual = self.model.compute_loss(self.batch)["bce"]
        self.assertTrue(torch.allclose(actual, expected))
        actual.backward()
        self.assertIsNone(self.model.interest_tower.weight.grad)
        self.assertGreater(float(self.model.codebooks[0].grad.abs().sum()), 0)

    def test_state_dict_round_trip(self) -> None:
        features = self.features[:, :2]
        mask = self.mask[:, :2]
        before = self.model.inference(features, mask)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "weights.pt"
            torch.save(self.model.state_dict(), path)
            restored = SparcModel(self.config)
            restored.load_state_dict(torch.load(path, map_location="cpu", weights_only=True))
            after = restored.inference(features, mask)
        for left, right in zip(before, after):
            self.assertTrue(torch.allclose(left, right))


class RetrievalAndArtifactTest(unittest.TestCase):
    def test_few_candidates_ignore_unused_interests_and_quota_ties_use_code_ids(self) -> None:
        class FixedModel:
            config = SimpleNamespace(input_dim=3)

            def inference(self, *_args):
                return torch.zeros(1, 3), torch.tensor([[0, 1, 2]]), torch.tensor([[0.5, 0.3, 0.2]]), torch.eye(3).unsqueeze(0)

            def encode_items(self, features):
                return features

        catalog = [CatalogItem("a", (10., 0., 0.)), CatalogItem("b", (0., 10., 100.))]
        history, mask = torch.zeros(1, 1, 3), torch.ones(1, 1, dtype=torch.bool)
        result = recommend(FixedModel(), history, mask, catalog, set(), 2)
        self.assertEqual([item.track_id for item in result], ["a", "b"])
        self.assertAlmostEqual(result[0].score, 6.25)
        self.assertAlmostEqual(result[1].score, 3.75)
        one = recommend(FixedModel(), history, mask, catalog, set(), 1)
        self.assertEqual([(item.track_id, item.score) for item in one], [("a", 10.)])
        self.assertEqual(_allocate_quota(torch.tensor([0.75, 0.25]), 4, [5, 1]), [2, 2])

    def test_smoke_learning_artifact_and_deterministic_search(self) -> None:
        config = SparcConfig(input_dim=8, d_model=16, stages=3, codes=8, interests=2, lmax=50, seed=0)
        model, catalog, metrics = train_smoke(config)
        self.assertLess(metrics["after"]["bce"], metrics["before"]["bce"])
        self.assertGreater(metrics["positive_margin"], 0)
        self.assertGreater(metrics["positive_margin"], metrics["before"]["positive_margin"])
        _, batch = make_smoke_data(config)
        excluded = {catalog[0].track_id, catalog[1].track_id}
        first = recommend(model, batch["history_features"][:1], batch["history_mask"][:1], catalog, excluded, 8)
        second = recommend(model, batch["history_features"][:1], batch["history_mask"][:1], catalog, excluded, 8)
        self.assertEqual(first, second)
        self.assertEqual(len(first), 8)
        self.assertEqual(len({item.track_id for item in first}), 8)
        self.assertTrue(all(item.track_id not in excluded for item in first))
        self.assertEqual(recommend(model, batch["history_features"][:1], batch["history_mask"][:1], catalog, {item.track_id for item in catalog}, 8), [])
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "artifact"
            with patch("recommendation.sparc.train._source_provenance", side_effect=AssertionError("provenance must be frozen at training")):
                artifact_id = write_artifact(output, model, catalog, metrics)
            manifest = json.loads((output / "manifest.json").read_text())
            self.assertRegex(manifest["code"]["commit"], r"^[0-9a-f]{40}$")
            self.assertIs(type(manifest["code"]["dirty"]), bool)
            root = Path(__file__).resolve().parents[2]
            for name, digest in manifest["code"]["source_files"].items():
                self.assertEqual(digest, hashlib.sha256((root / name).read_bytes()).hexdigest())
            self.assertEqual(manifest["training_inputs_sha256"], _batch_sha256(batch))
            changed_batch = dict(batch, labels=1 - batch["labels"])
            self.assertNotEqual(_batch_sha256(changed_batch), manifest["training_inputs_sha256"])
            self.assertRaises(FileExistsError, write_artifact, output, model, catalog, metrics)
            loaded = load_artifact(output)
            self.assertEqual(artifact_id, loaded.artifact_id)
            self.assertEqual(recommend(model, batch["history_features"][:1], batch["history_mask"][:1], catalog, excluded, 8), recommend(loaded.model, batch["history_features"][:1], batch["history_mask"][:1], loaded.catalog, excluded, 8))
            del manifest["training_inputs_sha256"]
            (output / "manifest.json").write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, "training-input hashes"):
                load_artifact(output)

    def test_loopback_http_validates_versions_ids_and_exhaustion(self) -> None:
        config = SparcConfig(input_dim=8, d_model=16, stages=3, codes=8, interests=2, lmax=50, seed=0)
        model, catalog, metrics = train_smoke(config)
        with tempfile.TemporaryDirectory() as directory:
            artifact_path = Path(directory) / "artifact"
            write_artifact(artifact_path, model, catalog, metrics)
            artifact = load_artifact(artifact_path)
            server = build_server(artifact, cors_origin="http://localhost:3000")
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            url = f"http://127.0.0.1:{server.server_port}/recommend"
            request = {"schema_version": "sparc-request-1", "artifact_id": artifact.artifact_id, "catalog_sha256": artifact.catalog_sha256, "current_track_id": catalog[0].track_id, "history_track_ids": [catalog[1].track_id], "excluded_track_ids": [catalog[0].track_id], "limit": 8}
            try:
                response = json.loads(urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(request).encode(), headers={"Content-Type": "application/json", "Origin": "http://localhost:3000"}), timeout=3).read())
                self.assertEqual(response["schema_version"], "sparc-response-1")
                self.assertEqual(len(response["recommendations"]), 8)
                bad = dict(request, artifact_id="0" * 64)
                with self.assertRaises(urllib.error.HTTPError) as mismatch:
                    urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(bad).encode()), timeout=3)
                self.assertEqual(mismatch.exception.code, 409)
                bad_id = dict(request, history_track_ids=["unknown"])
                with self.assertRaises(urllib.error.HTTPError) as unknown:
                    urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(bad_id).encode()), timeout=3)
                self.assertEqual(unknown.exception.code, 400)
                exhausted = dict(request, excluded_track_ids=[item.track_id for item in catalog])
                exhausted_response = urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(exhausted).encode()), timeout=3).read()
                self.assertEqual(json.loads(exhausted_response)["recommendations"], [])
                # Current is the only ID omitted from exclusions: the server must still exclude it.
                current_only = dict(request, excluded_track_ids=[item.track_id for item in catalog[1:]])
                current_response = urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(current_only).encode()), timeout=3).read()
                self.assertEqual(json.loads(current_response)["recommendations"], [])
            finally:
                server.shutdown()
                server.server_close()


if __name__ == "__main__":
    unittest.main()
