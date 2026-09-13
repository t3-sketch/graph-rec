import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tracks } from '../src/mocks/tracks';
import { MockRecommendationProvider } from '../src/services/recommendation';
import { buildCases, casesBytes, exportBundle, FIXTURE, hashBundleFiles } from '../src/research-export/exportBundle';
import { encodeJson, isIsoZ, parseJsonObject } from '../src/research-export/json';
import { parseCasesJsonl, validateCase, validateManifest } from '../src/research-export/validate';

function unusedDir(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `research-export-${label}-`));
  rmSync(dir, { recursive: true });
  return dir;
}

function sha(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

test('mock export has two cases whose titles and order match the live provider', async () => {
  const dir = unusedDir('ok');
  try {
    const { cases, manifest } = await exportBundle(dir);
    assert.equal(cases.length, 2);
    assert.equal(manifest.schema_version, '0.1');
    assert.equal(manifest.case_count, 2);
    const provider = new MockRecommendationProvider();
    const first = await provider.getRecommendations({
      currentTrackId: FIXTURE.seedTrackId, sessionPath: [FIXTURE.seedTrackId],
      exploredTrackIds: [FIXTURE.seedTrackId], limit: FIXTURE.seedLimit,
    });
    assert.equal(cases[0].input.current_track_id, tracks[0].id);
    assert.equal(cases[0].recommendations.length, first.length);
    cases[0].recommendations.forEach((row, i) => {
      assert.equal(row.rank, i + 1);
      assert.equal(row.track.id, first[i].track.id);
      assert.equal(row.track.title, first[i].track.title);
      assert.equal(row.track.artists[0].name, first[i].track.artists[0].name);
    });
    const nextId = first[0].track.id;
    const second = await provider.getRecommendations({
      currentTrackId: nextId, sessionPath: [FIXTURE.seedTrackId, nextId],
      exploredTrackIds: [FIXTURE.seedTrackId, nextId], limit: FIXTURE.nextLimit,
    });
    assert.equal(cases[1].input.current_track_id, nextId);
    assert.deepEqual(cases[1].input.session_path, [FIXTURE.seedTrackId, nextId]);
    cases[1].recommendations.forEach((row, i) => {
      assert.equal(row.track.id, second[i].track.id);
      assert.equal(row.track.title, second[i].track.title);
    });
    assert.equal(readFileSync(join(dir, 'human-ratings.jsonl')).length, 0);
    assert.equal(readFileSync(join(dir, 'llm-predictions.jsonl')).length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('same fixture twice writes identical cases bytes and hash', async () => {
  const a = unusedDir('a');
  const b = unusedDir('b');
  try {
    const first = await exportBundle(a);
    const second = await exportBundle(b);
    const left = readFileSync(join(a, 'cases.jsonl'));
    const right = readFileSync(join(b, 'cases.jsonl'));
    assert.deepEqual(left, right);
    assert.equal(first.manifest.cases_sha256, second.manifest.cases_sha256);
    assert.equal(sha(left), first.manifest.cases_sha256);
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test('refuses an existing output directory and leaves the four files unchanged', async () => {
  const dir = unusedDir('reuse');
  try {
    await exportBundle(dir);
    const before = hashBundleFiles(dir);
    await assert.rejects(() => exportBundle(dir), /Refusing to overwrite/);
    assert.deepEqual(hashBundleFiles(dir), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('rejects schema, key, type, rank, and rating-mix violations even when hashes are rewritten', async () => {
  const cases = await buildCases();
  const bytes = casesBytes(cases);
  const parsed = parseCasesJsonl(bytes.toString('utf8'));
  const good = parsed[0];
  const catalog = new Set(tracks.map(t => t.id));

  const manifestBase = {
    schema_version: '0.1', bundle_id: 'x', created_at: FIXTURE.createdAt, purpose: 'integration_test', data_kind: 'synthetic',
    producer: { project: 'Graph-Rec', commit: null, dirty: null, source_files: { 'package.json': 'a'.repeat(64) } },
    provider: { id: 'mock-recommendation', config: {} },
    dataset: { id: 'sonder-fictional-catalog', sha256: 'b'.repeat(64) },
    case_count: 1, cases_sha256: 'c'.repeat(64),
  };
  assert.throws(() => validateManifest({ ...manifestBase, schema_version: '0.2' }), /schema/);
  assert.throws(() => validateManifest({ ...manifestBase, extra: 1 } as never), /keys/);
  assert.throws(() => validateManifest({ schema_version: '0.1' } as never), /keys/);
  assert.throws(() => validateManifest({ ...manifestBase, case_count: true } as never), /case_count/);

  assert.throws(() => validateCase({ ...good, schema_version: 'nope' } as never, 'cases.jsonl', 1, catalog), /keys/);
  assert.throws(() => validateCase({ ...good, participant_id: 'person-1' }, 'cases.jsonl', 1, catalog), /participant_id/);
  assert.throws(() => validateCase({
    ...good, input: { ...good.input, human_rating: 5 },
  }, 'cases.jsonl', 1, catalog), /human_rating/);
  assert.throws(() => validateCase({
    ...good, presentation: { mode: 'shown_as_human' },
  }, 'cases.jsonl', 1, catalog), /presentation.mode/);
  assert.throws(() => validateCase({
    ...good, recommendations: [{ rank: 2, track: good.recommendations[0].track }],
  }, 'cases.jsonl', 1, catalog), /rank/);
  assert.throws(() => validateCase({
    ...good, recommendations: [
      good.recommendations[0],
      { rank: 2, track: good.recommendations[0].track },
    ],
  }, 'cases.jsonl', 1, catalog), /duplicate/);
  assert.throws(() => validateCase({
    ...good, recommendations: [{ rank: 1, track: { ...good.recommendations[0].track, id: good.input.current_track_id } }],
  }, 'cases.jsonl', 1, catalog), /already explored/);

  const dup = `${bytes.toString('utf8').trim()}\n${encodeJson({ ...good, case_id: good.case_id })}\n`;
  assert.throws(() => parseCasesJsonl(dup), /duplicate case_id/);

  const nanLine = encodeJson(good).replace('"limit":8', '"limit":NaN');
  assert.throws(() => parseJsonObject(nanLine, 'cases.jsonl:1'), /NaN|invalid JSON/);
  const dupKey = '{"case_id":"a","case_id":"b"}';
  assert.throws(() => parseJsonObject(dupKey, 'cases.jsonl:1'), /duplicate JSON key/);
  assert.throws(
    () => parseJsonObject('{"case_id":"first","\\u0063ase_id":"second"}', 'cases.jsonl:1'),
    /duplicate JSON key/,
  );
  assert.throws(
    () => parseJsonObject('{"case_id":"first","case_\\u0069d":"second"}', 'cases.jsonl:1'),
    /duplicate JSON key/,
  );

  for (const stamp of [
    '2024-02-29T23:59:59Z',
    '2000-02-29T00:00:00Z',
    '2026-01-31T00:00:00Z',
    '2026-04-30T12:00:00.123Z',
    FIXTURE.createdAt,
  ]) {
    assert.equal(isIsoZ(stamp), true, stamp);
  }
  for (const stamp of [
    '2026-99-99T99:99:99Z',
    '2025-02-29T00:00:00Z',
    '1900-02-29T00:00:00Z',
    '2026-04-31T00:00:00Z',
    '2026-02-30T00:00:00Z',
    '2026-13-01T00:00:00Z',
    '2026-00-01T00:00:00Z',
    '2026-01-00T00:00:00Z',
    '2026-09-13T24:00:00Z',
    '2026-09-13T00:60:00Z',
    '2026-09-13T00:00:60Z',
  ]) {
    assert.equal(isIsoZ(stamp), false, stamp);
    assert.throws(() => validateManifest({ ...manifestBase, created_at: stamp }), /created_at/);
    assert.throws(() => validateCase({ ...good, requested_at: stamp }, 'cases.jsonl', 1, catalog), /requested_at/);
  }
});

test('rejects tampered cases bytes and row-count mismatch; structure still fails after hash rewrite', async () => {
  const dir = unusedDir('tamper');
  try {
    const { manifest } = await exportBundle(dir);
    const original = readFileSync(join(dir, 'cases.jsonl'));
    writeFileSync(join(dir, 'cases.jsonl'), Buffer.concat([original, Buffer.from(' ')]));
    const tampered = readFileSync(join(dir, 'cases.jsonl'));
    assert.notEqual(sha(tampered), manifest.cases_sha256);

    const rewritten = { ...manifest, case_count: 99, cases_sha256: sha(original) };
    assert.notEqual(rewritten.case_count, original.toString('utf8').trim().split('\n').length);

    const broken = parseCasesJsonl(original.toString('utf8'));
    broken[0] = { ...broken[0], recommendations: [] as never };
    const brokenBytes = casesBytes(broken as never);
    const brokenManifest = {
      schema_version: '0.1', bundle_id: manifest.bundle_id, created_at: manifest.created_at,
      purpose: 'integration_test', data_kind: 'synthetic', producer: manifest.producer,
      provider: manifest.provider, dataset: manifest.dataset,
      case_count: 2, cases_sha256: sha(brokenBytes),
    };
    validateManifest(brokenManifest);
    assert.throws(() => parseCasesJsonl(brokenBytes.toString('utf8')), /recommendations/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
