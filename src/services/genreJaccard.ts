import type { RecommendationProvider, RecommendedTrack } from '@/domain/types';
import { fmaCatalog, fmaNumericId, fmaRecordById, toTrack } from '@/catalog/fma40';

function compareCandidates(
  left: { id: string; shared: number; union: number },
  right: { id: string; shared: number; union: number },
): number {
  const cross = left.shared * right.union - right.shared * left.union;
  if (cross !== 0) return cross > 0 ? -1 : 1;
  return fmaNumericId(left.id) - fmaNumericId(right.id);
}

export function rankGenreJaccard(
  seedId: string,
  excluded: ReadonlySet<string>,
  limit: number,
  catalog: typeof fmaCatalog = fmaCatalog,
): RecommendedTrack[] {
  const seed = catalog.find(record => record.id === seedId) ?? (catalog === fmaCatalog ? fmaRecordById.get(seedId) : undefined);
  if (!seed) return [];
  const seedGenres = new Set(seed.genre_ids);
  const eligible = catalog
    .filter(record => !excluded.has(record.id) && record.id !== seedId)
    .map(record => {
      const candidateGenres = new Set(record.genre_ids);
      let shared = 0;
      for (const id of seedGenres) if (candidateGenres.has(id)) shared += 1;
      const union = new Set([...seedGenres, ...candidateGenres]).size;
      return { record, shared, union };
    })
    .sort((left, right) => compareCandidates(
      { id: left.record.id, shared: left.shared, union: left.union },
      { id: right.record.id, shared: right.shared, union: right.union },
    ));
  return eligible.slice(0, limit).map(item => ({
    track: toTrack(item.record),
    sharedGenreCount: item.shared,
    unionGenreCount: item.union,
  }));
}

export class GenreJaccardProvider implements RecommendationProvider {
  async getRecommendations(context: Parameters<RecommendationProvider['getRecommendations']>[0]) {
    const excluded = new Set([...context.exploredTrackIds, context.currentTrackId]);
    return rankGenreJaccard(context.currentTrackId, excluded, context.limit);
  }
}
