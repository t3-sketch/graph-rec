import type { RecommendationProvider } from '@/domain/types';
import { tracks } from '@/mocks/tracks';
export class MockRecommendationProvider implements RecommendationProvider {
  async getRecommendations(context: Parameters<RecommendationProvider['getRecommendations']>[0]) {
    await new Promise(resolve => setTimeout(resolve, 220));
    const seen = new Set([...context.exploredTrackIds, context.currentTrackId]);
    return tracks.filter(t => !seen.has(t.id)).slice(0, context.limit).map(track => ({ track }));
  }
}
