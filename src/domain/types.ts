export type Track = {
  id: string;
  title: string;
  artists: { id?: string; name: string }[];
  album?: { id?: string; name?: string; imageUrl?: string };
  durationMs?: number;
  artworkUrl?: string;
  previewUrl?: string;
  genreIds?: number[];
  genreNames?: string[];
  sourceUrl?: string;
  licenseUrl?: string;
  audioSha256?: string;
  externalIds?: { spotify?: string; appleMusic?: string; musicbrainz?: string; isrc?: string };
};
export type Point = { x: number; y: number };
export type MusicGraphNode = {
  nodeId: string; track: Track; parentNodeId?: string; depth: number; position: Point;
  state: 'seed' | 'explored' | 'active' | 'recommendation';
  expanded?: boolean;
  sharedGenreCount?: number;
};
export type Scores = { relevance?: number; novelty?: number; unexpectedness?: number; serendipity?: number };
export type MusicGraphEdge = { id: string; sourceNodeId: string; targetNodeId: string; relation?: Scores & { similarity?: number } };
export type InteractionEvent = 'node_impression' | 'node_expand' | 'preview_start' | 'preview_pause' | 'preview_complete' | 'skip' | 'replay' | 'save' | 'like' | 'open_external';
export type InteractionEventRecord = { type: InteractionEvent; trackId: string; timestamp: string; detail?: string };
export type SessionCaseRecommendation = { rank: number; track_id: string; shared_genre_count: number; union_genre_count: number };
export type SessionCase = {
  case_id: string; participant_id: null; session_id: string; requested_at: string;
  input: { current_track_id: string; session_path: string[]; explored_track_ids: string[]; limit: number };
  recommendations: SessionCaseRecommendation[];
  presentation: { mode: 'graph_committed' };
};
export type SessionResearchEvent = {
  event_id: string; session_id: string; case_id: string; track_id: string; occurred_at: string;
  type: 'node_impression' | 'node_expand' | 'preview_start' | 'preview_pause' | 'preview_complete' | 'like' | 'save';
  value: boolean | null;
};
export type SessionBuildProvenance = {
  catalog_sha256: string;
  commit: string | null;
  dirty: boolean | null;
  source_files: Record<string, string>;
};
export type ExplorationSession = {
  id: string; startedAt: string; seedTrackId: string; activeNodeId: string;
  nodes: MusicGraphNode[]; edges: MusicGraphEdge[]; interactionEvents: InteractionEventRecord[];
  playlistContext?: { providerId: string; playlistId: string };
  datasetId?: string; providerId?: string; cases?: SessionCase[];
  researchEvents?: SessionResearchEvent[]; nodeOriginCaseId?: Record<string, string>;
  buildProvenance?: SessionBuildProvenance;
};
export type RecommendationContext = { currentTrackId: string; sessionPath: string[]; exploredTrackIds: string[]; limit: number; playlistContext?: ExplorationSession['playlistContext']; historyTrackIds?: string[] };
export type RecommendedTrack = { track: Track; scores?: Scores; sharedGenreCount?: number; unionGenreCount?: number };
export interface RecommendationProvider { getRecommendations(context: RecommendationContext): Promise<RecommendedTrack[]> }
export interface GraphPlacementStrategy { placeChildren(args: { parent?: MusicGraphNode; current: MusicGraphNode; count: number; existingNodes: MusicGraphNode[] }): Point[] }
