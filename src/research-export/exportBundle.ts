import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RecommendationContext, RecommendedTrack, Track } from '../domain/types';
import { tracks } from '../mocks/tracks';
import { MockRecommendationProvider } from '../services/recommendation';
import { encodeJson, fail, posixSourcePath } from './json';
import { BUNDLE_FILES, ExportCase, Manifest, SCHEMA_VERSION, SOURCE_FILES, SnapshotTrack } from './schema';
import { parseCasesJsonl, validateCase, validateManifest } from './validate';

export const FIXTURE = {
  bundleId: 'sonder-mock-integration-001',
  createdAt: '2026-09-13T00:00:00Z',
  requestedAt: '2026-09-13T00:00:00Z',
  sessionId: 'synthetic-session-001',
  seedTrackId: 'sonder-1',
  seedLimit: 8,
  nextLimit: 7,
};

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function sha256Bytes(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function fileSha(rel: string): string {
  if (!posixSourcePath(rel)) throw fail('source_files', rel, 'illegal path');
  return sha256Bytes(readFileSync(join(repoRoot, rel)));
}

function gitState(): { commit: string | null; dirty: boolean | null } {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!/^[0-9a-f]{40}$/.test(commit)) return { commit: null, dirty: null };
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { commit, dirty: status.length > 0 };
  } catch {
    return { commit: null, dirty: null };
  }
}

function snapshotTrack(track: Track): SnapshotTrack {
  if (!track.id || !track.title) throw fail('track', '', 'id and title required');
  if (!track.artists?.length) throw fail('track.artists', '', 'need one or more artists');
  return { id: track.id, title: track.title, artists: track.artists.map(artist => ({ name: artist.name })) };
}

function rejectScores(items: RecommendedTrack[]): void {
  for (const item of items) {
    if (item.scores && Object.values(item.scores).some(value => value != null)) {
      throw fail('recommendations', 'scores', 'unsupported non-empty scores; stop for design review');
    }
  }
}

function context(current: string, path: string[], explored: string[], limit: number): RecommendationContext {
  return { currentTrackId: current, sessionPath: path, exploredTrackIds: explored, limit };
}

async function oneCase(id: string, ctx: RecommendationContext, provider: MockRecommendationProvider): Promise<ExportCase> {
  if (ctx.playlistContext) throw fail('input.playlistContext', '', 'unsupported');
  const catalog = new Set(tracks.map(track => track.id));
  const recs = await provider.getRecommendations(ctx);
  rejectScores(recs);
  const raw = {
    case_id: id,
    participant_id: null,
    session_id: FIXTURE.sessionId,
    requested_at: FIXTURE.requestedAt,
    input: {
      current_track_id: ctx.currentTrackId,
      session_path: ctx.sessionPath,
      explored_track_ids: ctx.exploredTrackIds,
      limit: ctx.limit,
    },
    recommendations: recs.map((item, index) => ({ rank: index + 1, track: snapshotTrack(item.track) })),
    presentation: { mode: 'not_presented' as const },
  };
  return validateCase(raw, 'cases.jsonl', Number(id.slice(-1)) || 1, catalog);
}

export function casesBytes(cases: ExportCase[]): Buffer {
  return Buffer.from(cases.map(item => encodeJson(item)).join('\n') + '\n', 'utf8');
}

export function sourceFiles(): Record<string, string> {
  const hashed: Record<string, string> = {};
  for (const rel of SOURCE_FILES) hashed[rel] = fileSha(rel);
  return hashed;
}

export async function buildCases(): Promise<ExportCase[]> {
  const provider = new MockRecommendationProvider();
  const seed = await oneCase('case-001', context(FIXTURE.seedTrackId, [FIXTURE.seedTrackId], [FIXTURE.seedTrackId], FIXTURE.seedLimit), provider);
  const nextId = seed.recommendations[0].track.id;
  const next = await oneCase(
    'case-002',
    context(nextId, [FIXTURE.seedTrackId, nextId], [FIXTURE.seedTrackId, nextId], FIXTURE.nextLimit),
    provider,
  );
  return [seed, next];
}

export function buildManifest(cases: ExportCase[], bytes: Buffer): Manifest {
  const git = gitState();
  const raw = {
    schema_version: SCHEMA_VERSION,
    bundle_id: FIXTURE.bundleId,
    created_at: FIXTURE.createdAt,
    purpose: 'integration_test',
    data_kind: 'synthetic',
    producer: {
      project: 'Graph-Rec',
      commit: git.commit,
      dirty: git.dirty,
      source_files: sourceFiles(),
    },
    provider: { id: 'mock-recommendation', config: {} },
    dataset: { id: 'sonder-fictional-catalog', sha256: fileSha('src/mocks/tracks.ts') },
    case_count: cases.length,
    cases_sha256: sha256Bytes(bytes),
  };
  return validateManifest(raw);
}

export async function exportBundle(outputDir: string): Promise<{ manifest: Manifest; cases: ExportCase[] }> {
  if (existsSync(outputDir)) throw new Error(`Refusing to overwrite ${outputDir}; choose an unused directory`);
  mkdirSync(outputDir, { recursive: true });
  try {
    const cases = await buildCases();
    const bytes = casesBytes(cases);
    parseCasesJsonl(bytes.toString('utf8'), 'cases.jsonl', new Set(tracks.map(track => track.id)));
    const manifest = buildManifest(cases, bytes);
    writeFileSync(join(outputDir, 'cases.jsonl'), bytes);
    writeFileSync(join(outputDir, 'manifest.json'), `${encodeJson(manifest)}\n`);
    writeFileSync(join(outputDir, 'human-ratings.jsonl'), Buffer.alloc(0));
    writeFileSync(join(outputDir, 'llm-predictions.jsonl'), Buffer.alloc(0));
    return { manifest, cases };
  } catch (error) {
    throw new Error(`Export failed after creating ${outputDir}: ${error instanceof Error ? error.message : error}`);
  }
}

export function hashBundleFiles(outputDir: string): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const name of BUNDLE_FILES) hashes[name] = sha256Bytes(readFileSync(join(outputDir, name)));
  return hashes;
}
