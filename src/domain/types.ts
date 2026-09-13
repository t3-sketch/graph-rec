export type Track = {
  id: string;
  title: string;
  artists: { id?: string; name: string }[];
  album?: { id?: string; name?: string; imageUrl?: string };
  durationMs?: number;
  artworkUrl?: string;
  previewUrl?: string;
  externalIds?: { spotify?: string; appleMusic?: string; musicbrainz?: string; isrc?: string };
};
export type Point = { x: number; y: number };
export type MusicGraphNode = {
  nodeId: string; track: Track; parentNodeId?: string; depth: number; position: Point;
  state: 'seed' | 'explored' | 'active' | 'recommendation';
  expanded?: boolean;
};
export type Scores = { relevance?: number; novelty?: number; unexpectedness?: number; serendipity?: number };
export type MusicGraphEdge = { id: string; sourceNodeId: string; targetNodeId: string; relation?: Scores & { similarity?: number } };
export type InteractionEvent = 'node_impression' | 'node_expand' | 'preview_start' | 'preview_pause' | 'preview_complete' | 'skip' | 'replay' | 'save' | 'like' | 'open_external';
export type InteractionEventRecord = { type: InteractionEvent; trackId: string; timestamp: string; detail?: string };
export type ExplorationSession = {
  id: string; startedAt: string; seedTrackId: string; activeNodeId: string;
  nodes: MusicGraphNode[]; edges: MusicGraphEdge[]; interactionEvents: InteractionEventRecord[];
  playlistContext?: { providerId: string; playlistId: string };
};
export type RecommendationContext = { currentTrackId: string; sessionPath: string[]; exploredTrackIds: string[]; limit: number; playlistContext?: ExplorationSession['playlistContext'] };
export type RecommendedTrack = { track: Track; scores?: Scores };
export interface RecommendationProvider { getRecommendations(context: RecommendationContext): Promise<RecommendedTrack[]> }
export interface GraphPlacementStrategy { placeChildren(args: { parent?: MusicGraphNode; current: MusicGraphNode; count: number; existingNodes: MusicGraphNode[] }): Point[] }
