import { fmaCatalog, fmaNumericId, fmaRecordById, type FmaCatalogRecord } from '@/catalog/fma40';
import { exactKeys, fail, isInt, isIsoZ, isNonEmptyString, isSha256 } from './json';
import { rankGenreJaccard } from '@/services/genreJaccard';
import { canonicalSha256 } from './canonical';
import { CATALOG_KEYS, CASE_V2_KEYS, EVENT_KEYS, EVENT_TYPES, MANIFEST_V2_KEYS, REC_V2_KEYS, SCHEMA_VERSION_V2 } from './schemaV2';
import { PRODUCER_KEYS, PROVIDER_KEYS, DATASET_KEYS, INPUT_KEYS, ARTIST_KEYS } from './schema';
import { posixSourcePath, isCommit } from './json';

export type CatalogRecord = {
  id: string; title: string; artists: { name: string }[]; genre_ids: number[]; genre_names: string[];
  source_url: string; license_url: string; audio_sha256: string; preview_duration_ms: number;
};
export type CaseV2 = {
  case_id: string; participant_id: null; session_id: string; requested_at: string;
  input: { current_track_id: string; session_path: string[]; explored_track_ids: string[]; limit: number };
  recommendations: { rank: number; track_id: string; shared_genre_count: number; union_genre_count: number }[];
  presentation: { mode: 'graph_committed' | 'not_presented' };
};
export type EventV2 = {
  event_id: string; session_id: string; case_id: string; track_id: string; occurred_at: string;
  type: typeof EVENT_TYPES[number]; value: boolean | null;
};
export type ManifestV2 = {
  schema_version: '0.2'; bundle_id: string; created_at: string; purpose: 'engineering_demo'; data_kind: 'real_catalog';
  session_id: string;
  producer: { project: 'Graph-Rec'; commit: string | null; dirty: boolean | null; source_files: Record<string, string> };
  provider: { id: 'genre-jaccard-v1'; config: Record<string, never> };
  dataset: { id: 'sonder-fma-40-v1'; sha256: string };
  case_count: number; event_count: number; cases_sha256: string; events_sha256: string;
};

const LICENSE = new Set(fmaCatalog.map(item => item.license_url));

function httpsUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\/[^ ]+$/.test(value);
}

export function validateManifestV2(raw: Record<string, unknown>, file = 'bundle.json'): ManifestV2 {
  if (!exactKeys(raw, MANIFEST_V2_KEYS)) throw fail(file, 'manifest', 'unexpected or missing keys');
  if (raw.schema_version !== SCHEMA_VERSION_V2) throw fail(file, 'schema_version', 'unsupported schema');
  if (!isNonEmptyString(raw.bundle_id)) throw fail(file, 'bundle_id', 'must be a non-empty string');
  if (!isIsoZ(raw.created_at)) throw fail(file, 'created_at', 'must be a real UTC ISO-8601 timestamp ending with Z');
  if (raw.purpose !== 'engineering_demo') throw fail(file, 'purpose', 'must be engineering_demo');
  if (raw.data_kind !== 'real_catalog') throw fail(file, 'data_kind', 'must be real_catalog');
  if (!isNonEmptyString(raw.session_id)) throw fail(file, 'session_id', 'must be a non-empty string');
  if (raw.producer === null || typeof raw.producer !== 'object' || Array.isArray(raw.producer) || !exactKeys(raw.producer, PRODUCER_KEYS)) {
    throw fail(file, 'producer', 'invalid object');
  }
  const producer = raw.producer as Record<string, unknown>;
  if (producer.project !== 'Graph-Rec') throw fail(file, 'producer.project', 'must be Graph-Rec');
  if (producer.commit !== null && !isCommit(producer.commit)) throw fail(file, 'producer.commit', 'must be 40-char lowercase hex or null');
  if (producer.commit === null) {
    if (producer.dirty !== null) throw fail(file, 'producer.dirty', 'must be null when commit is null');
  } else if (typeof producer.dirty !== 'boolean') {
    throw fail(file, 'producer.dirty', 'must be boolean when commit is set');
  }
  if (producer.source_files === null || typeof producer.source_files !== 'object' || Array.isArray(producer.source_files) || Object.keys(producer.source_files).length === 0) {
    throw fail(file, 'producer.source_files', 'must be a non-empty object');
  }
  for (const [path, hash] of Object.entries(producer.source_files as Record<string, unknown>)) {
    if (!posixSourcePath(path) || path.includes('provenance.generated')) throw fail(file, 'producer.source_files', `illegal path ${path}`);
    if (!isSha256(hash)) throw fail(file, 'producer.source_files', `hash for ${path}`);
  }
  if (raw.provider === null || typeof raw.provider !== 'object' || Array.isArray(raw.provider) || !exactKeys(raw.provider, PROVIDER_KEYS)) {
    throw fail(file, 'provider', 'invalid object');
  }
  const provider = raw.provider as Record<string, unknown>;
  if (provider.id !== 'genre-jaccard-v1') throw fail(file, 'provider.id', 'must be genre-jaccard-v1');
  if (provider.config === null || typeof provider.config !== 'object' || Array.isArray(provider.config) || Object.keys(provider.config).length !== 0) {
    throw fail(file, 'provider.config', 'must be empty object');
  }
  if (raw.dataset === null || typeof raw.dataset !== 'object' || Array.isArray(raw.dataset) || !exactKeys(raw.dataset, DATASET_KEYS)) {
    throw fail(file, 'dataset', 'invalid object');
  }
  const dataset = raw.dataset as Record<string, unknown>;
  if (dataset.id !== 'sonder-fma-40-v1') throw fail(file, 'dataset.id', 'must be sonder-fma-40-v1');
  if (!isSha256(dataset.sha256)) throw fail(file, 'dataset.sha256', 'must be sha256');
  if (!isInt(raw.case_count) || raw.case_count < 1) throw fail(file, 'case_count', 'must be a positive integer');
  if (typeof raw.event_count === 'boolean' || !isInt(raw.event_count) || raw.event_count < 0) throw fail(file, 'event_count', 'must be a nonnegative integer');
  if (!isSha256(raw.cases_sha256) || !isSha256(raw.events_sha256)) throw fail(file, 'hash', 'cases/events hash');
  return raw as ManifestV2;
}

export function validateCatalog(raw: unknown, file = 'bundle.json'): CatalogRecord[] {
  if (!Array.isArray(raw) || raw.length !== 40) throw fail(file, 'catalog', 'must contain exactly 40 records');
  const ids = new Set<string>();
  const genreMap = new Map<number, string>();
  let previous = 0;
  const records = raw.map((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item) || !exactKeys(item, CATALOG_KEYS)) {
      throw fail(file, 'catalog', `unexpected or missing keys at ${index}`);
    }
    const rec = item as Record<string, unknown>;
    if (!isNonEmptyString(rec.id) || !/^fma-\d{6}$/.test(rec.id)) throw fail(file, 'catalog.id', 'must be fma- plus six digits');
    const numeric = fmaNumericId(rec.id);
    if (numeric <= previous) throw fail(file, 'catalog', 'must be sorted by numeric FMA ID');
    previous = numeric;
    if (ids.has(rec.id)) throw fail(file, 'catalog.id', 'duplicate');
    ids.add(rec.id);
    if (!isNonEmptyString(rec.title)) throw fail(file, 'catalog.title', 'must be non-empty');
    if (!Array.isArray(rec.artists) || rec.artists.length < 1) throw fail(file, 'catalog.artists', 'need one or more artists');
    for (const artist of rec.artists) {
      if (artist === null || typeof artist !== 'object' || Array.isArray(artist) || !exactKeys(artist, ARTIST_KEYS) || !isNonEmptyString((artist as { name: unknown }).name)) {
        throw fail(file, 'catalog.artists', 'each artist must be {name}');
      }
    }
    if (!Array.isArray(rec.genre_ids) || rec.genre_ids.length < 1 || !rec.genre_ids.every(id => isInt(id) && id > 0)) {
      throw fail(file, 'catalog.genre_ids', 'must be unique ascending positive integers');
    }
    if (new Set(rec.genre_ids).size !== rec.genre_ids.length || rec.genre_ids.some((id, i) => i > 0 && id <= (rec.genre_ids as number[])[i - 1])) {
      throw fail(file, 'catalog.genre_ids', 'must be unique ascending positive integers');
    }
    if (!Array.isArray(rec.genre_names) || rec.genre_names.length !== rec.genre_ids.length || !rec.genre_names.every(isNonEmptyString)) {
      throw fail(file, 'catalog.genre_names', 'must match genre_ids');
    }
    rec.genre_ids.forEach((id, i) => {
      const name = (rec.genre_names as string[])[i];
      const seen = genreMap.get(id);
      if (seen && seen !== name) throw fail(file, 'catalog.genre_names', `id ${id} maps to more than one name`);
      genreMap.set(id, name);
    });
    if (!httpsUrl(rec.source_url)) throw fail(file, 'catalog.source_url', 'must be https');
    if (!httpsUrl(rec.license_url) || !LICENSE.has(rec.license_url)) throw fail(file, 'catalog.license_url', 'not on the audited allowlist');
    if (!isSha256(rec.audio_sha256)) throw fail(file, 'catalog.audio_sha256', 'must be sha256');
    if (!isInt(rec.preview_duration_ms) || rec.preview_duration_ms < 1) throw fail(file, 'catalog.preview_duration_ms', 'must be a positive integer');
    return rec as CatalogRecord;
  });
  return records;
}

export function validateCaseV2(raw: Record<string, unknown>, catalog: Map<string, CatalogRecord>, createdAt: string, sessionId: string, file = 'bundle.json', line = 1): CaseV2 {
  if (!exactKeys(raw, CASE_V2_KEYS)) throw fail(file, 'cases', 'unexpected or missing keys', line);
  if (!isNonEmptyString(raw.case_id)) throw fail(file, 'case_id', 'must be a non-empty string', line);
  if (raw.participant_id !== null) throw fail(file, 'participant_id', 'must be null', line);
  if (raw.session_id !== sessionId) throw fail(file, 'session_id', 'must match manifest.session_id', line);
  if (!isIsoZ(raw.requested_at) || Date.parse(raw.requested_at) > Date.parse(createdAt)) throw fail(file, 'requested_at', 'must be a real UTC timestamp <= created_at', line);
  if (raw.input === null || typeof raw.input !== 'object' || Array.isArray(raw.input) || !exactKeys(raw.input, INPUT_KEYS)) {
    throw fail(file, 'input', 'unexpected or missing keys', line);
  }
  const input = raw.input as Record<string, unknown>;
  if ('human_rating' in input) throw fail(file, 'input.human_rating', 'ratings must not be mixed into input', line);
  if (!isNonEmptyString(input.current_track_id) || !catalog.has(input.current_track_id)) throw fail(file, 'input.current_track_id', 'unknown catalog id', line);
  if (!Array.isArray(input.session_path) || input.session_path.length === 0 || !input.session_path.every(isNonEmptyString)) {
    throw fail(file, 'input.session_path', 'must be a non-empty string array', line);
  }
  if (new Set(input.session_path).size !== input.session_path.length) throw fail(file, 'input.session_path', 'must be unique', line);
  if (input.session_path.at(-1) !== input.current_track_id) throw fail(file, 'input.session_path', 'must end with current_track_id', line);
  if (!Array.isArray(input.explored_track_ids) || !input.explored_track_ids.every(isNonEmptyString) || new Set(input.explored_track_ids).size !== input.explored_track_ids.length) {
    throw fail(file, 'input.explored_track_ids', 'must be unique strings', line);
  }
  for (const id of [input.current_track_id, ...input.session_path]) {
    if (!input.explored_track_ids.includes(id)) throw fail(file, 'input.explored_track_ids', `missing ${id}`, line);
  }
  for (const id of input.explored_track_ids) if (!catalog.has(id)) throw fail(file, 'input.explored_track_ids', `unknown ${id}`, line);
  const seedPath = input.session_path.length === 1;
  if (typeof input.limit === 'boolean' || !isInt(input.limit) || input.limit !== (seedPath ? 8 : 7)) {
    throw fail(file, 'input.limit', 'must be 8 for a one-track seed path, otherwise 7', line);
  }
  if (!Array.isArray(raw.recommendations) || raw.recommendations.length > input.limit) throw fail(file, 'recommendations', 'must have 0..limit items', line);
  raw.recommendations.forEach((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item) || !exactKeys(item, REC_V2_KEYS)) throw fail(file, 'recommendations', 'each item must be rank/track/counts', line);
    const rec = item as Record<string, unknown>;
    if (!isInt(rec.rank) || rec.rank !== index + 1) throw fail(file, 'rank', 'must be consecutive integers starting at 1', line);
    if (!isNonEmptyString(rec.track_id) || !catalog.has(rec.track_id)) throw fail(file, 'track_id', 'unknown catalog id', line);
    if ((input.explored_track_ids as string[]).includes(rec.track_id)) throw fail(file, 'track_id', 'already explored', line);
    if (!isInt(rec.union_genre_count) || rec.union_genre_count < 1) throw fail(file, 'union_genre_count', 'must be a positive integer', line);
    if (typeof rec.shared_genre_count === 'boolean' || !isInt(rec.shared_genre_count) || rec.shared_genre_count < 0 || rec.shared_genre_count > rec.union_genre_count) {
      throw fail(file, 'shared_genre_count', 'must be 0..union', line);
    }
  });
  const recIds = raw.recommendations.map(item => (item as { track_id: string }).track_id);
  if (new Set(recIds).size !== recIds.length) throw fail(file, 'track_id', 'duplicate in case', line);
  const expected = rankGenreJaccard(
    input.current_track_id as string,
    new Set(input.explored_track_ids as string[]),
    input.limit as number,
    [...catalog.values()] as FmaCatalogRecord[],
  );
  if (expected.length !== raw.recommendations.length) throw fail(file, 'recommendations', 'omitted eligible candidates or extra rows', line);
  raw.recommendations.forEach((item, index) => {
    const rec = item as { track_id: string; shared_genre_count: number; union_genre_count: number };
    const want = expected[index];
    if (rec.track_id !== want.track.id || rec.shared_genre_count !== want.sharedGenreCount || rec.union_genre_count !== want.unionGenreCount) {
      throw fail(file, 'recommendations', 'rank or counts do not match recomputed Jaccard order', line);
    }
  });
  if (raw.presentation === null || typeof raw.presentation !== 'object' || Array.isArray(raw.presentation) || !exactKeys(raw.presentation, ['mode'])) {
    throw fail(file, 'presentation', 'must be {mode}', line);
  }
  const mode = (raw.presentation as { mode: unknown }).mode;
  if (mode !== 'graph_committed' && mode !== 'not_presented') throw fail(file, 'presentation.mode', 'unsupported', line);
  return raw as CaseV2;
}

export function validateEventV2(raw: Record<string, unknown>, cases: CaseV2[], createdAt: string, sessionId: string, file = 'bundle.json', line = 1): EventV2 {
  if (!exactKeys(raw, EVENT_KEYS)) throw fail(file, 'events', 'unexpected or missing keys', line);
  if (!isNonEmptyString(raw.event_id)) throw fail(file, 'event_id', 'must be a non-empty string', line);
  if (raw.session_id !== sessionId) throw fail(file, 'session_id', 'must match manifest.session_id', line);
  const associated = cases.find(item => item.case_id === raw.case_id);
  if (!associated) throw fail(file, 'case_id', 'must reference an existing case', line);
  if (!isNonEmptyString(raw.track_id)) throw fail(file, 'track_id', 'must be a non-empty string', line);
  const allowedTracks = new Set([associated.input.current_track_id, ...associated.recommendations.map(item => item.track_id)]);
  if (!allowedTracks.has(raw.track_id)) throw fail(file, 'track_id', 'must be the case seed or a recommendation', line);
  if (!isIsoZ(raw.occurred_at) || Date.parse(raw.occurred_at) < Date.parse(associated.requested_at) || Date.parse(raw.occurred_at) > Date.parse(createdAt)) {
    throw fail(file, 'occurred_at', 'must be requested_at..created_at', line);
  }
  if (!EVENT_TYPES.includes(raw.type as typeof EVENT_TYPES[number])) throw fail(file, 'type', 'unknown event type', line);
  if (raw.type === 'like' || raw.type === 'save') {
    if (typeof raw.value !== 'boolean') throw fail(file, 'value', 'like/save value must be boolean', line);
  } else if (raw.value !== null) {
    throw fail(file, 'value', 'must be null for this event type', line);
  }
  return raw as EventV2;
}

export async function validateBundleObject(raw: Record<string, unknown>): Promise<{ manifest: ManifestV2; catalog: CatalogRecord[]; cases: CaseV2[]; events: EventV2[] }> {
  if (!exactKeys(raw, ['manifest', 'catalog', 'cases', 'events', 'human_ratings', 'llm_predictions'])) {
    throw fail('bundle.json', '', 'unexpected or missing keys');
  }
  if (!Array.isArray(raw.human_ratings) || raw.human_ratings.length !== 0) throw fail('bundle.json', 'human_ratings', 'version 0.2 requires an empty array');
  if (!Array.isArray(raw.llm_predictions) || raw.llm_predictions.length !== 0) throw fail('bundle.json', 'llm_predictions', 'version 0.2 requires an empty array');
  if (raw.manifest === null || typeof raw.manifest !== 'object' || Array.isArray(raw.manifest)) throw fail('bundle.json', 'manifest', 'must be an object');
  const manifest = validateManifestV2(raw.manifest as Record<string, unknown>);
  const catalog = validateCatalog(raw.catalog);
  if (await canonicalSha256(catalog) !== manifest.dataset.sha256) throw fail('bundle.json', 'dataset.sha256', 'does not match canonical catalog');
  const catalogMap = new Map(catalog.map(item => [item.id, item]));
  if (!Array.isArray(raw.cases) || raw.cases.length !== manifest.case_count) throw fail('bundle.json', 'case_count', 'does not match cases.length');
  const cases = raw.cases.map((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) throw fail('bundle.json', 'cases', 'each case must be an object', index + 1);
    return validateCaseV2(item as Record<string, unknown>, catalogMap, manifest.created_at, manifest.session_id, 'bundle.json', index + 1);
  });
  const caseIds = cases.map(item => item.case_id);
  if (new Set(caseIds).size !== caseIds.length) throw fail('bundle.json', 'case_id', 'duplicate case_id');
  const modes = new Set(cases.map(item => item.presentation.mode));
  if (modes.size !== 1) throw fail('bundle.json', 'presentation.mode', 'do not mix modes in one bundle');
  if (!Array.isArray(raw.events) || raw.events.length !== manifest.event_count) throw fail('bundle.json', 'event_count', 'does not match events.length');
  if (modes.has('not_presented') && raw.events.length !== 0) throw fail('bundle.json', 'events', 'not_presented bundles require an empty events array');
  const events = raw.events.map((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) throw fail('bundle.json', 'events', 'each event must be an object', index + 1);
    return validateEventV2(item as Record<string, unknown>, cases, manifest.created_at, manifest.session_id, 'bundle.json', index + 1);
  });
  const eventIds = events.map(item => item.event_id);
  if (new Set(eventIds).size !== eventIds.length) throw fail('bundle.json', 'event_id', 'duplicate event_id');
  const impressions = new Set<string>();
  for (const event of events) {
    if (event.type !== 'node_impression') continue;
    const key = `${event.case_id}:${event.track_id}`;
    if (impressions.has(key)) throw fail('bundle.json', 'events', 'duplicate viewport impression');
    impressions.add(key);
  }
  if (await canonicalSha256(cases) !== manifest.cases_sha256) throw fail('bundle.json', 'cases_sha256', 'does not match canonical cases');
  if (await canonicalSha256(events) !== manifest.events_sha256) throw fail('bundle.json', 'events_sha256', 'does not match canonical events');
  return { manifest, catalog, cases, events };
}

export function expectedCatalog(): CatalogRecord[] {
  return fmaCatalog.map(item => ({
    id: item.id, title: item.title, artists: item.artists, genre_ids: item.genre_ids, genre_names: item.genre_names,
    source_url: item.source_url, license_url: item.license_url, audio_sha256: item.audio_sha256, preview_duration_ms: item.preview_duration_ms,
  }));
}

export { fmaRecordById };
