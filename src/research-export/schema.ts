export const SCHEMA_VERSION = '0.1';
export const MANIFEST_KEYS = [
  'schema_version', 'bundle_id', 'created_at', 'purpose', 'data_kind',
  'producer', 'provider', 'dataset', 'case_count', 'cases_sha256',
] as const;
export const PRODUCER_KEYS = ['project', 'commit', 'dirty', 'source_files'] as const;
export const PROVIDER_KEYS = ['id', 'config'] as const;
export const DATASET_KEYS = ['id', 'sha256'] as const;
export const CASE_KEYS = [
  'case_id', 'participant_id', 'session_id', 'requested_at', 'input', 'recommendations', 'presentation',
] as const;
export const INPUT_KEYS = ['current_track_id', 'session_path', 'explored_track_ids', 'limit'] as const;
export const REC_KEYS = ['rank', 'track'] as const;
export const TRACK_KEYS = ['id', 'title', 'artists'] as const;
export const ARTIST_KEYS = ['name'] as const;

export const SOURCE_FILES = [
  'package-lock.json',
  'package.json',
  'scripts/export-research.ts',
  'src/domain/types.ts',
  'src/mocks/tracks.ts',
  'src/research-export/exportBundle.ts',
  'src/research-export/json.ts',
  'src/research-export/schema.ts',
  'src/research-export/validate.ts',
  'src/services/recommendation.ts',
] as const;

export const BUNDLE_FILES = ['manifest.json', 'cases.jsonl', 'human-ratings.jsonl', 'llm-predictions.jsonl'] as const;

export type SnapshotTrack = { id: string; title: string; artists: { name: string }[] };
export type ExportCase = {
  case_id: string;
  participant_id: null;
  session_id: string;
  requested_at: string;
  input: {
    current_track_id: string;
    session_path: string[];
    explored_track_ids: string[];
    limit: number;
  };
  recommendations: { rank: number; track: SnapshotTrack }[];
  presentation: { mode: 'not_presented' };
};

export type Manifest = {
  schema_version: '0.1';
  bundle_id: string;
  created_at: string;
  purpose: 'integration_test';
  data_kind: 'synthetic';
  producer: {
    project: 'Graph-Rec';
    commit: string | null;
    dirty: boolean | null;
    source_files: Record<string, string>;
  };
  provider: { id: 'mock-recommendation'; config: Record<string, never> };
  dataset: { id: 'sonder-fictional-catalog'; sha256: string };
  case_count: number;
  cases_sha256: string;
};
