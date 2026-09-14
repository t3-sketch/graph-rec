import { GenreJaccardProvider } from './genreJaccard';
import { DirectionalPlacementStrategy } from '@/graph/placement';
import type { RecommendationProvider, GraphPlacementStrategy } from '@/domain/types';
// Change these providers at the composition root; graph components know neither implementation.
export const dependencies: { recommendation: RecommendationProvider; placement: GraphPlacementStrategy } = {
  recommendation: new GenreJaccardProvider(), placement: new DirectionalPlacementStrategy(),
};
