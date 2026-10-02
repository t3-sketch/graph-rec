import type { RecommendationContext, RecommendationProvider, RecommendedTrack, Track } from '@/domain/types';

type CatalogTrack = Pick<Track, 'id'> & Track;

type SparcProviderOptions = {
  endpoint: string;
  artifactId: string;
  catalogSha256: string;
  catalog: readonly CatalogTrack[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type SparcRequest = {
  schema_version: 'sparc-request-1';
  artifact_id: string;
  catalog_sha256: string;
  current_track_id: string;
  history_track_ids: string[];
  excluded_track_ids: string[];
  limit: number;
};

type SparcResponse = {
  schema_version: 'sparc-response-1';
  artifact_id: string;
  catalog_sha256: string;
  recommendations: { track_id: string; score: number }[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isHash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export class SparcProvider implements RecommendationProvider {
  private readonly endpoint: string;
  private readonly artifactId: string;
  private readonly catalogSha256: string;
  private readonly catalog: Map<string, Track>;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: SparcProviderOptions) {
    if (!options.endpoint || !isHash(options.artifactId) || !isHash(options.catalogSha256) || !options.catalog.length) throw new Error('Invalid SPARC provider configuration');
    this.endpoint = options.endpoint;
    this.artifactId = options.artifactId;
    this.catalogSha256 = options.catalogSha256;
    this.catalog = new Map();
    for (const track of options.catalog) {
      if (!track.id || this.catalog.has(track.id)) throw new Error('SPARC catalog IDs must be unique');
      this.catalog.set(track.id, track);
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 3000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0) throw new Error('Invalid SPARC timeout');
  }

  async getRecommendations(context: RecommendationContext): Promise<RecommendedTrack[]> {
    const history = context.historyTrackIds ?? [];
    const excluded = [...new Set([...context.exploredTrackIds, context.currentTrackId])];
    for (const id of [context.currentTrackId, ...history, ...excluded]) if (!this.catalog.has(id)) throw new Error(`Unknown SPARC track ID: ${id}`);
    if (!Number.isInteger(context.limit) || context.limit < 1 || context.limit > 8) throw new Error('Invalid SPARC limit');
    const request: SparcRequest = {
      schema_version: 'sparc-request-1', artifact_id: this.artifactId, catalog_sha256: this.catalogSha256,
      current_track_id: context.currentTrackId, history_track_ids: [...history], excluded_track_ids: excluded, limit: context.limit,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal });
      const body: unknown = await response.json();
      if (!response.ok) {
        if (!isRecord(body) || !exactKeys(body, ['error']) || !isRecord(body.error) || !exactKeys(body.error, ['code', 'message']) || typeof body.error.code !== 'string' || typeof body.error.message !== 'string') throw new Error('Invalid SPARC error response');
        throw new Error(`SPARC ${body.error.code}: ${body.error.message}`);
      }
      if (!isRecord(body) || !exactKeys(body, ['schema_version', 'artifact_id', 'catalog_sha256', 'recommendations']) || body.schema_version !== 'sparc-response-1' || body.artifact_id !== this.artifactId || body.catalog_sha256 !== this.catalogSha256 || !Array.isArray(body.recommendations)) throw new Error('Invalid SPARC response envelope');
      const seen = new Set<string>();
      const eligibleCount = this.catalog.size - excluded.length;
      if (body.recommendations.length !== Math.min(context.limit, eligibleCount)) throw new Error('Invalid SPARC response count');
      return body.recommendations.map((item: unknown): RecommendedTrack => {
        if (!isRecord(item) || !exactKeys(item, ['track_id', 'score']) || typeof item.track_id !== 'string' || typeof item.score !== 'number' || !Number.isFinite(item.score) || seen.has(item.track_id) || excluded.includes(item.track_id)) throw new Error('Invalid SPARC recommendation');
        const trackId = item.track_id;
        const score = item.score;
        const track = this.catalog.get(trackId);
        if (!track) throw new Error(`Unknown SPARC response track ID: ${trackId}`);
        seen.add(trackId);
        return { track, scores: { relevance: score } };
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new Error(`SPARC request timed out after ${this.timeoutMs}ms`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
