import { rankGenreJaccard } from '@/services/genreJaccard';
import type { ExplorationSession } from '@/domain/types';
import { isCurrentBuildSession } from '@/graph/session';
import { canonicalSha256 } from './canonical';
import { PROVENANCE } from './provenance.generated';
import { expectedCatalog, validateBundleObject, type CaseV2, type EventV2, type ManifestV2 } from './validateV2';

export const FMA_FIXTURE = {
  bundleId: 'sonder-fma40-integration-001',
  createdAt: '2026-09-13T00:00:00Z',
  requestedAt: '2026-09-13T00:00:00Z',
  sessionId: 'synthetic-fma-session-001',
  seedTrackId: 'fma-015769',
};

export type BundleV2 = {
  manifest: ManifestV2;
  catalog: ReturnType<typeof expectedCatalog>;
  cases: CaseV2[];
  events: EventV2[];
  human_ratings: [];
  llm_predictions: [];
};

export async function buildV2Bundle(args: {
  bundleId: string;
  createdAt: string;
  sessionId: string;
  cases: CaseV2[];
  events: EventV2[];
}): Promise<BundleV2> {
  const catalog = expectedCatalog();
  const catalogHash = await canonicalSha256(catalog);
  if (catalogHash !== PROVENANCE.catalog_sha256) {
    throw new Error('Catalog hash does not match build provenance');
  }
  const casesHash = await canonicalSha256(args.cases);
  const eventsHash = await canonicalSha256(args.events);
  const manifest: ManifestV2 = {
    schema_version: '0.2',
    bundle_id: args.bundleId,
    created_at: args.createdAt,
    purpose: 'engineering_demo',
    data_kind: 'real_catalog',
    session_id: args.sessionId,
    producer: {
      project: 'Graph-Rec',
      commit: PROVENANCE.commit,
      dirty: PROVENANCE.dirty,
      source_files: PROVENANCE.source_files,
    },
    provider: { id: 'genre-jaccard-v1', config: {} },
    dataset: { id: 'sonder-fma-40-v1', sha256: catalogHash },
    case_count: args.cases.length,
    event_count: args.events.length,
    cases_sha256: casesHash,
    events_sha256: eventsHash,
  };
  const bundle: BundleV2 = {
    manifest, catalog, cases: args.cases, events: args.events, human_ratings: [], llm_predictions: [],
  };
  await validateBundleObject(bundle as unknown as Record<string, unknown>);
  return bundle;
}

export function fixtureCases(): CaseV2[] {
  const cases: CaseV2[] = [];
  let current = FMA_FIXTURE.seedTrackId;
  const path = [current];
  const explored = [current];
  for (const [index, limit] of [8, 7, 7].entries()) {
    const recs = rankGenreJaccard(current, new Set(explored), limit);
    cases.push({
      case_id: `case-00${index + 1}`,
      participant_id: null,
      session_id: FMA_FIXTURE.sessionId,
      requested_at: FMA_FIXTURE.requestedAt,
      input: {
        current_track_id: current,
        session_path: [...path],
        explored_track_ids: [...explored],
        limit,
      },
      recommendations: recs.map((item, rank) => ({
        rank: rank + 1,
        track_id: item.track.id,
        shared_genre_count: item.sharedGenreCount ?? 0,
        union_genre_count: item.unionGenreCount ?? 1,
      })),
      presentation: { mode: 'not_presented' },
    });
    if (!recs[0]) break;
    current = recs[0].track.id;
    path.push(current);
    for (const item of recs) {
      if (!explored.includes(item.track.id)) explored.push(item.track.id);
    }
  }
  return cases;
}

export async function bundleFromSession(session: ExplorationSession): Promise<BundleV2> {
  if (!session.cases?.length) throw new Error('A session with no completed cases cannot be exported');
  if (!isCurrentBuildSession(session)) throw new Error('This saved map is from a different build or catalog. Start a new exploration.');
  return buildV2Bundle({
    bundleId: `sonder-session-${session.id}`,
    createdAt: new Date().toISOString(),
    sessionId: session.id,
    cases: session.cases.map(item => ({ ...item, presentation: { mode: 'graph_committed' as const } })),
    events: session.researchEvents || [],
  });
}
