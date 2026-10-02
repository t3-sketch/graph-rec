import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { dependencies } from '../src/services/dependencies';
import { GenreJaccardProvider } from '../src/services/genreJaccard';
import { SparcProvider } from '../src/services/sparc';
import type { Track } from '../src/domain/types';

const tracks: Track[] = [
  { id: 'synthetic-00', title: 'Zero', artists: [{ name: 'Fixture' }] },
  { id: 'synthetic-01', title: 'One', artists: [{ name: 'Fixture' }] },
  { id: 'synthetic-02', title: 'Two', artists: [{ name: 'Fixture' }] },
];
const hash = 'a'.repeat(64);

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function provider(fetchImpl: typeof fetch = async () => response(200, {
  schema_version: 'sparc-response-1', artifact_id: hash, catalog_sha256: hash,
  recommendations: [{ track_id: 'synthetic-02', score: 0.25 }],
})) {
  return new SparcProvider({ endpoint: 'http://127.0.0.1:8787/recommend', artifactId: hash, catalogSha256: hash, catalog: tracks, fetchImpl, timeoutMs: 30 });
}

test('SPARC adapter validates the envelope and maps relevance without changing the default provider', async () => {
  assert.ok(dependencies.recommendation instanceof GenreJaccardProvider);
  let sent: unknown;
  const result = await provider(async (_input, init) => {
    sent = JSON.parse(String(init?.body));
    return response(200, { schema_version: 'sparc-response-1', artifact_id: hash, catalog_sha256: hash, recommendations: [{ track_id: 'synthetic-02', score: 0.25 }] });
  }).getRecommendations({ currentTrackId: 'synthetic-00', sessionPath: ['synthetic-00'], exploredTrackIds: ['synthetic-00'], historyTrackIds: ['synthetic-01'], limit: 1 });
  assert.equal(result[0].track.id, 'synthetic-02');
  assert.deepEqual(result[0].scores, { relevance: 0.25 });
  assert.deepEqual((sent as { excluded_track_ids: string[] }).excluded_track_ids, ['synthetic-00']);
  assert.deepEqual((sent as { history_track_ids: string[] }).history_track_ids, ['synthetic-01']);
});

test('SPARC adapter completes a real loopback HTTP fixture', async () => {
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ schema_version: 'sparc-response-1', artifact_id: hash, catalog_sha256: hash, recommendations: [{ track_id: 'synthetic-02', score: 0.5 }] }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const result = await new SparcProvider({ endpoint: `http://127.0.0.1:${address.port}/recommend`, artifactId: hash, catalogSha256: hash, catalog: tracks, timeoutMs: 1000 }).getRecommendations({ currentTrackId: 'synthetic-00', sessionPath: [], exploredTrackIds: ['synthetic-00'], limit: 1 });
    assert.equal(result[0].scores?.relevance, 0.5);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('SPARC adapter rejects unknown IDs, version mismatches, extra keys, and non-finite scores', async () => {
  await assert.rejects(() => provider(async () => response(200, { schema_version: 'sparc-response-1', artifact_id: hash, catalog_sha256: hash, recommendations: [{ track_id: 'unknown', score: 1 }] })).getRecommendations({ currentTrackId: 'synthetic-00', sessionPath: [], exploredTrackIds: ['synthetic-00'], limit: 1 }), /Unknown SPARC response track ID/);
  await assert.rejects(() => provider(async () => response(409, { error: { code: 'ARTIFACT_MISMATCH', message: 'wrong version' } })).getRecommendations({ currentTrackId: 'synthetic-00', sessionPath: [], exploredTrackIds: ['synthetic-00'], limit: 1 }), /ARTIFACT_MISMATCH/);
  await assert.rejects(() => provider(async () => response(200, { schema_version: 'sparc-response-1', artifact_id: hash, catalog_sha256: hash, recommendations: [], extra: true })).getRecommendations({ currentTrackId: 'synthetic-00', sessionPath: [], exploredTrackIds: ['synthetic-00'], limit: 1 }), /Invalid SPARC response envelope/);
  await assert.rejects(() => provider(async () => response(200, { schema_version: 'sparc-response-1', artifact_id: hash, catalog_sha256: hash, recommendations: [{ track_id: 'synthetic-02', score: Number.NaN }] })).getRecommendations({ currentTrackId: 'synthetic-00', sessionPath: [], exploredTrackIds: ['synthetic-00'], limit: 1 }), /Invalid SPARC recommendation/);
  await assert.rejects(() => provider().getRecommendations({ currentTrackId: 'unknown', sessionPath: [], exploredTrackIds: [], limit: 1 }), /Unknown SPARC track ID/);
});

test('SPARC adapter turns timeout into a failed request and clears the timer', async () => {
  await assert.rejects(() => provider(async (_input, init) => {
    await new Promise<void>(resolve => {
      init?.signal?.addEventListener('abort', () => resolve(), { once: true });
    });
    throw new DOMException('aborted', 'AbortError');
  }).getRecommendations({ currentTrackId: 'synthetic-00', sessionPath: [], exploredTrackIds: ['synthetic-00'], limit: 1 }), /timed out/);
});
