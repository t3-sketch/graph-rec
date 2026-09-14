export const SCHEMA_VERSION_V2 = '0.2';
export const BUNDLE_V2_KEYS = ['manifest', 'catalog', 'cases', 'events', 'human_ratings', 'llm_predictions'] as const;
export const MANIFEST_V2_KEYS = [
  'schema_version', 'bundle_id', 'created_at', 'purpose', 'data_kind', 'session_id',
  'producer', 'provider', 'dataset', 'case_count', 'event_count', 'cases_sha256', 'events_sha256',
] as const;
export const CATALOG_KEYS = [
  'id', 'title', 'artists', 'genre_ids', 'genre_names', 'source_url', 'license_url', 'audio_sha256', 'preview_duration_ms',
] as const;
export const CASE_V2_KEYS = ['case_id', 'participant_id', 'session_id', 'requested_at', 'input', 'recommendations', 'presentation'] as const;
export const REC_V2_KEYS = ['rank', 'track_id', 'shared_genre_count', 'union_genre_count'] as const;
export const EVENT_KEYS = ['event_id', 'session_id', 'case_id', 'track_id', 'occurred_at', 'type', 'value'] as const;
export const EVENT_TYPES = ['node_impression', 'node_expand', 'preview_start', 'preview_pause', 'preview_complete', 'like', 'save'] as const;
export const SOURCE_FILES_V2 = [
  'package-lock.json',
  'package.json',
  'scripts/export-research.ts',
  'src/catalog/fma40-catalog.json',
  'src/catalog/fma40.ts',
  'src/components/Explorer.tsx',
  'src/components/MiniPlayer.tsx',
  'src/components/SongNode.tsx',
  'src/components/TrackInspector.tsx',
  'src/domain/types.ts',
  'src/graph/session.ts',
  'src/research-export/buildV2.ts',
  'src/research-export/canonical.ts',
  'src/research-export/exportBundle.ts',
  'src/research-export/exportBundleV2.ts',
  'src/research-export/json.ts',
  'src/research-export/schema.ts',
  'src/research-export/schemaV2.ts',
  'src/research-export/validate.ts',
  'src/research-export/validateV2.ts',
  'src/services/dependencies.ts',
  'src/services/genreJaccard.ts',
  'src/services/recommendation.ts',
  'src/store/exploration.ts',
] as const;
