import { ARTIST_KEYS, CASE_KEYS, DATASET_KEYS, ExportCase, INPUT_KEYS, MANIFEST_KEYS, Manifest, PRODUCER_KEYS, PROVIDER_KEYS, REC_KEYS, SCHEMA_VERSION, TRACK_KEYS } from './schema';
import { exactKeys, fail, isCommit, isInt, isIsoZ, isNonEmptyString, isSha256, parseJsonObject, posixSourcePath } from './json';

export function validateManifest(raw: Record<string, unknown>, file = 'manifest.json'): Manifest {
  if (!exactKeys(raw, MANIFEST_KEYS)) throw fail(file, '', 'unexpected or missing keys');
  if (raw.schema_version !== SCHEMA_VERSION) throw fail(file, 'schema_version', 'unsupported schema');
  if (!isNonEmptyString(raw.bundle_id)) throw fail(file, 'bundle_id', 'must be a non-empty string');
  if (!isIsoZ(raw.created_at)) throw fail(file, 'created_at', 'must be UTC ISO-8601 ending with Z');
  if (raw.purpose !== 'integration_test') throw fail(file, 'purpose', 'must be integration_test');
  if (raw.data_kind !== 'synthetic') throw fail(file, 'data_kind', 'must be synthetic');
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
  if (producer.source_files === null || typeof producer.source_files !== 'object' || Array.isArray(producer.source_files)) {
    throw fail(file, 'producer.source_files', 'must be a non-empty object');
  }
  const sourceFiles = producer.source_files as Record<string, unknown>;
  if (Object.keys(sourceFiles).length === 0) throw fail(file, 'producer.source_files', 'must be non-empty');
  for (const [path, hash] of Object.entries(sourceFiles)) {
    if (!posixSourcePath(path)) throw fail(file, 'producer.source_files', `illegal path ${path}`);
    if (!isSha256(hash)) throw fail(file, 'producer.source_files', `hash for ${path}`);
  }
  if (raw.provider === null || typeof raw.provider !== 'object' || Array.isArray(raw.provider) || !exactKeys(raw.provider, PROVIDER_KEYS)) {
    throw fail(file, 'provider', 'invalid object');
  }
  const provider = raw.provider as Record<string, unknown>;
  if (provider.id !== 'mock-recommendation') throw fail(file, 'provider.id', 'must be mock-recommendation');
  if (provider.config === null || typeof provider.config !== 'object' || Array.isArray(provider.config) || Object.keys(provider.config).length !== 0) {
    throw fail(file, 'provider.config', 'must be empty object');
  }
  if (raw.dataset === null || typeof raw.dataset !== 'object' || Array.isArray(raw.dataset) || !exactKeys(raw.dataset, DATASET_KEYS)) {
    throw fail(file, 'dataset', 'invalid object');
  }
  const dataset = raw.dataset as Record<string, unknown>;
  if (dataset.id !== 'sonder-fictional-catalog') throw fail(file, 'dataset.id', 'must be sonder-fictional-catalog');
  if (!isSha256(dataset.sha256)) throw fail(file, 'dataset.sha256', 'must be sha256');
  if (!isInt(raw.case_count) || raw.case_count < 1) throw fail(file, 'case_count', 'must be a positive integer');
  if (!isSha256(raw.cases_sha256)) throw fail(file, 'cases_sha256', 'must be sha256');
  return raw as Manifest;
}

export function validateCase(raw: Record<string, unknown>, file: string, line: number, catalog?: Set<string>): ExportCase {
  if (!exactKeys(raw, CASE_KEYS)) throw fail(file, '', 'unexpected or missing keys', line);
  if (!isNonEmptyString(raw.case_id)) throw fail(file, 'case_id', 'must be a non-empty string', line);
  if (raw.participant_id !== null) throw fail(file, 'participant_id', 'must be null', line);
  if (!isNonEmptyString(raw.session_id)) throw fail(file, 'session_id', 'must be a non-empty string', line);
  if (!isIsoZ(raw.requested_at)) throw fail(file, 'requested_at', 'must be UTC ISO-8601 ending with Z', line);
  if (raw.input === null || typeof raw.input !== 'object' || Array.isArray(raw.input)) throw fail(file, 'input', 'must be an object', line);
  const input = raw.input as Record<string, unknown>;
  if ('human_rating' in input || 'human_ratings' in input) throw fail(file, 'input.human_rating', 'ratings must not be mixed into input', line);
  if ('playlistContext' in input && input.playlistContext != null && input.playlistContext !== '') {
    throw fail(file, 'input.playlistContext', 'unsupported', line);
  }
  if (!exactKeys(input, INPUT_KEYS)) throw fail(file, 'input', 'unexpected or missing keys', line);
  if (!isNonEmptyString(input.current_track_id)) throw fail(file, 'input.current_track_id', 'must be a non-empty string', line);
  if (!Array.isArray(input.session_path) || input.session_path.length === 0 || !input.session_path.every(isNonEmptyString)) {
    throw fail(file, 'input.session_path', 'must be a non-empty string array', line);
  }
  if (input.session_path.at(-1) !== input.current_track_id) throw fail(file, 'input.session_path', 'must end with current_track_id', line);
  const explored = input.explored_track_ids;
  if (!Array.isArray(explored) || !explored.every(isNonEmptyString)) {
    throw fail(file, 'input.explored_track_ids', 'must be a string array', line);
  }
  if (new Set(explored).size !== explored.length) {
    throw fail(file, 'input.explored_track_ids', 'must be unique', line);
  }
  for (const id of [input.current_track_id, ...input.session_path]) {
    if (!explored.includes(id)) throw fail(file, 'input.explored_track_ids', `missing ${id}`, line);
  }
  if (typeof input.limit === 'boolean' || !isInt(input.limit) || input.limit < 1 || input.limit > 100) {
    throw fail(file, 'input.limit', 'must be an integer 1..100', line);
  }
  if (catalog) {
    for (const id of explored) {
      if (!catalog.has(id)) throw fail(file, 'input.explored_track_ids', `unknown track ${id}`, line);
    }
  }
  if (!Array.isArray(raw.recommendations) || raw.recommendations.length < 1 || raw.recommendations.length > input.limit) {
    throw fail(file, 'recommendations', 'must have 1..limit items', line);
  }
  const seenTracks = new Set<string>();
  raw.recommendations.forEach((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item) || !exactKeys(item, REC_KEYS)) {
      throw fail(file, 'recommendations', 'each item must be {rank,track}', line);
    }
    const rec = item as Record<string, unknown>;
    if (!isInt(rec.rank) || rec.rank !== index + 1) throw fail(file, 'rank', 'must be consecutive integers starting at 1', line);
    if (rec.track === null || typeof rec.track !== 'object' || Array.isArray(rec.track) || !exactKeys(rec.track, TRACK_KEYS)) {
      throw fail(file, 'track', 'must be {id,title,artists}', line);
    }
    const track = rec.track as Record<string, unknown>;
    if (!isNonEmptyString(track.id) || !isNonEmptyString(track.title)) throw fail(file, 'track', 'id and title must be non-empty', line);
    if (explored.includes(track.id)) throw fail(file, 'track.id', 'already explored', line);
    if (seenTracks.has(track.id)) throw fail(file, 'track.id', 'duplicate in case', line);
    seenTracks.add(track.id);
    if (!Array.isArray(track.artists) || track.artists.length < 1) throw fail(file, 'track.artists', 'need one or more artists', line);
    for (const artist of track.artists) {
      if (artist === null || typeof artist !== 'object' || Array.isArray(artist) || !exactKeys(artist, ARTIST_KEYS)) {
        throw fail(file, 'track.artists', 'each artist must be {name}', line);
      }
      if (!isNonEmptyString((artist as { name: unknown }).name)) throw fail(file, 'track.artists', 'name must be non-empty', line);
    }
  });
  if (raw.presentation === null || typeof raw.presentation !== 'object' || Array.isArray(raw.presentation) || !exactKeys(raw.presentation, ['mode'])) {
    throw fail(file, 'presentation', 'must be {mode}', line);
  }
  if ((raw.presentation as { mode: unknown }).mode !== 'not_presented') {
    throw fail(file, 'presentation.mode', 'must be not_presented', line);
  }
  return raw as ExportCase;
}

export function parseCasesJsonl(text: string, file = 'cases.jsonl', catalog?: Set<string>): ExportCase[] {
  if (text.charCodeAt(0) === 0xfeff) throw fail(file, '', 'BOM is not allowed');
  if (!text.endsWith('\n')) throw fail(file, '', 'missing trailing newline');
  const lines = text.slice(0, -1).split('\n');
  if (lines.some(line => line.length === 0)) throw fail(file, '', 'empty line');
  const cases = lines.map((line, index) => validateCase(parseJsonObject(line, `${file}:${index + 1}`), file, index + 1, catalog));
  const ids = cases.map(item => item.case_id);
  if (new Set(ids).size !== ids.length) throw fail(file, 'case_id', 'duplicate case_id');
  return cases;
}
