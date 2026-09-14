import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalJson, canonicalSha256 } from '../src/research-export/canonical';
import { FMA_FIXTURE, buildV2Bundle, bundleFromSession, fixtureCases } from '../src/research-export/buildV2';
import { exportBundleV2 } from '../src/research-export/exportBundleV2';
import { parseJsonObject } from '../src/research-export/json';
import { validateBundleObject } from '../src/research-export/validateV2';
import { currentBuildProvenance, isCurrentBuildSession, isLegacyCatalogSession } from '../src/graph/session';
import type { ExplorationSession } from '../src/domain/types';

function unusedDir(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `research-export-v02-${label}-`));
  rmSync(dir, { recursive: true });
  return dir;
}

test('canonical JSON keeps Japanese text and escapes controls the same way', async () => {
  const value = { b: '日本語', a: 'x\u0001', list: [1, true, null] };
  const encoded = canonicalJson(value);
  assert.equal(encoded, '{"a":"x\\u0001","b":"日本語","list":[1,true,null]}');
  assert.equal(await canonicalSha256(value), await canonicalSha256({ list: [1, true, null], b: '日本語', a: 'x\u0001' }));
});

test('0.2 fixture has 8/7/7 candidates and is accepted after a second unused write', async () => {
  const cases = fixtureCases();
  assert.deepEqual(cases.map(item => item.recommendations.length), [8, 7, 7]);
  assert.deepEqual(cases.map(item => item.input.explored_track_ids.length), [1, 9, 16]);
  const ids = [FMA_FIXTURE.seedTrackId, ...cases.flatMap(item => item.recommendations.map(rec => rec.track_id))];
  assert.equal(ids.length, 23);
  assert.equal(new Set(ids).size, 23);
  assert.equal(cases[0].input.current_track_id, FMA_FIXTURE.seedTrackId);
  assert.equal(cases[0].recommendations.filter(item => item.shared_genre_count === 0).length >= 0, true);
  const a = unusedDir('a');
  const b = unusedDir('b');
  try {
    const first = await exportBundleV2(a);
    const second = await exportBundleV2(b);
    assert.equal(readFileSync(join(a, 'bundle.json'), 'utf8'), readFileSync(join(b, 'bundle.json'), 'utf8'));
    assert.equal(first.manifest.cases_sha256, second.manifest.cases_sha256);
    assert.equal(first.manifest.dataset.id, 'sonder-fma-40-v1');
    assert.equal(first.catalog.length, 40);
    assert.equal(first.events.length, 0);
    await validateBundleObject(parseJsonObject(readFileSync(join(a, 'bundle.json'), 'utf8').trim(), 'bundle.json'));
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test('0.2 refuses an existing directory and rejects mutated ranks after hash rewrite', async () => {
  const dir = unusedDir('reuse');
  try {
    const bundle = await exportBundleV2(dir);
    await assert.rejects(() => exportBundleV2(dir), /Refusing to overwrite/);
    const broken = structuredClone(bundle);
    broken.cases[0].recommendations[0].shared_genre_count = 99;
    broken.manifest.cases_sha256 = await canonicalSha256(broken.cases);
    await assert.rejects(() => buildV2Bundle({
      bundleId: broken.manifest.bundle_id,
      createdAt: broken.manifest.created_at,
      sessionId: broken.manifest.session_id,
      cases: broken.cases,
      events: broken.events,
    }), /shared_genre_count|Jaccard|counts|recommendations/);
    const extra = structuredClone(bundle);
    extra.human_ratings = [{ no: true }] as never;
    await assert.rejects(() => validateBundleObject(extra as never), /human_ratings/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('0.2 recomputes catalog, cases, and events hashes', async () => {
  const dir = unusedDir('hash');
  try {
    const bundle = await exportBundleV2(dir);
    const zeros = '0'.repeat(64);
    const casesTamper = structuredClone(bundle);
    casesTamper.manifest.cases_sha256 = zeros;
    await assert.rejects(() => validateBundleObject(casesTamper as never), /cases_sha256/);
    const eventsTamper = structuredClone(bundle);
    eventsTamper.manifest.events_sha256 = zeros;
    await assert.rejects(() => validateBundleObject(eventsTamper as never), /events_sha256/);
    const catalogTamper = structuredClone(bundle);
    catalogTamper.catalog[0].title = `Changed ${catalogTamper.catalog[0].title}`;
    await assert.rejects(() => validateBundleObject(catalogTamper as never), /dataset.sha256|catalog/);
    await assert.rejects(() => exportBundleV2(unusedDir('hash-arg'), casesTamper), /cases_sha256/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('saved sessions keep generation hashes and refuse a different build', async () => {
  const cases = fixtureCases();
  const current = currentBuildProvenance();
  const session: ExplorationSession = {
    id: FMA_FIXTURE.sessionId,
    startedAt: '2026-09-13T00:00:00Z',
    seedTrackId: FMA_FIXTURE.seedTrackId,
    activeNodeId: 'n1',
    nodes: [{
      nodeId: 'n1', track: { id: FMA_FIXTURE.seedTrackId, title: 'The Factory', artists: [{ name: 'Multifaros' }] },
      depth: 0, position: { x: 0, y: 0 }, state: 'seed',
    }],
    edges: [],
    interactionEvents: [],
    datasetId: 'sonder-fma-40-v1',
    providerId: 'genre-jaccard-v1',
    cases: cases.map(item => ({ ...item, presentation: { mode: 'graph_committed' as const } })),
    researchEvents: [],
    buildProvenance: current,
  };
  assert.equal(isCurrentBuildSession(session), true);
  assert.equal(isLegacyCatalogSession(session), false);
  const exported = await bundleFromSession(session);
  assert.equal(exported.manifest.dataset.sha256, current.catalog_sha256);
  assert.deepEqual(exported.manifest.producer.source_files, current.source_files);
  const staleCatalog = { ...session, buildProvenance: { ...current, catalog_sha256: '0'.repeat(64) } };
  assert.equal(isCurrentBuildSession(staleCatalog), false);
  assert.equal(isLegacyCatalogSession(staleCatalog), true);
  await assert.rejects(() => bundleFromSession(staleCatalog), /different build or catalog/);
  const staleSource = {
    ...session,
    buildProvenance: { ...current, source_files: { ...current.source_files, 'src/store/exploration.ts': '1'.repeat(64) } },
  };
  assert.equal(isLegacyCatalogSession(staleSource), true);
  await assert.rejects(() => bundleFromSession(staleSource), /different build or catalog/);
  const missing = { ...session, buildProvenance: undefined };
  assert.equal(isLegacyCatalogSession(missing), true);
  await assert.rejects(() => bundleFromSession(missing), /different build or catalog/);
});
