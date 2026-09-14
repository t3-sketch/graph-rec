import { create } from 'zustand';
import type { ExplorationSession, Track, Point, InteractionEvent, MusicGraphNode, SessionCase, SessionResearchEvent } from '@/domain/types';
import { activePath, currentBuildProvenance, restoreSession, STORAGE_KEY, isLegacyCatalogSession } from '@/graph/session';
import { dependencies } from '@/services/dependencies';
import { FMA40_DATASET_ID, FMA40_PROVIDER_ID } from '@/catalog/fma40';

type State = {
  session: ExplorationSession | null; ready: boolean; loading: boolean; error: string | null; storageError: boolean;
  liked: string[]; saved: string[];
  initialize(): void; start(track: Track, playlistContext?: ExplorationSession['playlistContext']): Promise<void>;
  expand(nodeId: string): Promise<void>; move(nodeId: string, position: Point): void; clear(): void;
  emit(type: InteractionEvent, trackId: string, detail?: string, nodeId?: string): void; toggle(kind: 'liked' | 'saved', trackId: string): void;
};
let requestId = 0;

function isFmaTrack(track: Track): boolean {
  return track.id.startsWith('fma-');
}

function resolveOriginCase(session: ExplorationSession, trackId: string, nodeId?: string): string | undefined {
  const origins = session.nodeOriginCaseId || {};
  if (nodeId && origins[nodeId]) return origins[nodeId];
  const node = session.nodes.find(item => item.nodeId === nodeId) || session.nodes.find(item => item.track.id === trackId);
  if (node && origins[node.nodeId]) return origins[node.nodeId];
  if (trackId === session.seedTrackId && session.cases?.[0]) return session.cases[0].case_id;
  return undefined;
}

export const useExploration = create<State>((set, get) => ({
  session: null, ready: false, loading: false, error: null, storageError: false, liked: [], saved: [],
  initialize() {
    if (get().ready) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('sonder.exploration.v1');
      const session = restoreSession(raw);
      let collection: { liked?: unknown; saved?: unknown } = {};
      try { collection = JSON.parse(localStorage.getItem('sonder.collection.v1') || '{}') || {}; } catch { /* The graph is independent of collection recovery. */ }
      if (session && isLegacyCatalogSession(session)) {
        set({
          ready: true, session: null,
          error: 'This saved map is from a different build or catalog. Start a new exploration.',
          liked: Array.isArray(collection.liked) ? collection.liked.filter((x: unknown) => typeof x === 'string' && x.startsWith('fma-')) : [],
          saved: Array.isArray(collection.saved) ? collection.saved.filter((x: unknown) => typeof x === 'string' && x.startsWith('fma-')) : [],
        });
        return;
      }
      set({ ready: true, session, error: raw && !session ? 'The saved map could not be restored. Start a new exploration.' : null,
        liked: Array.isArray(collection.liked) ? collection.liked.filter((x: unknown) => typeof x === 'string') : [], saved: Array.isArray(collection.saved) ? collection.saved.filter((x: unknown) => typeof x === 'string') : [] });
    } catch { set({ ready: true, storageError: true }); }
  },
  async start(track, playlistContext) {
    ++requestId;
    const fma = isFmaTrack(track);
    const node: MusicGraphNode = { nodeId: crypto.randomUUID(), track, depth: 0, position: { x: 0, y: 0 }, state: 'active' };
    set({ session: {
      id: crypto.randomUUID(), startedAt: new Date().toISOString(), seedTrackId: track.id, activeNodeId: node.nodeId,
      nodes: [node], edges: [], interactionEvents: [], playlistContext,
      datasetId: fma ? FMA40_DATASET_ID : undefined, providerId: fma ? FMA40_PROVIDER_ID : undefined,
      cases: fma ? [] : undefined, researchEvents: fma ? [] : undefined, nodeOriginCaseId: fma ? {} : undefined,
      buildProvenance: fma ? currentBuildProvenance() : undefined,
    }, loading: false, error: null });
    await get().expand(node.nodeId);
  },
  async expand(nodeId) {
    const initial = get().session;
    if (!initial) return;
    const selected = initial.nodes.find(n => n.nodeId === nodeId);
    if (!selected) return;
    const token = ++requestId;
    const session: ExplorationSession = { ...initial, activeNodeId: nodeId, nodes: initial.nodes.map(n => n.nodeId === nodeId ? { ...n, state: 'active' } : n.state === 'active' ? { ...n, state: n.depth === 0 ? 'seed' : 'explored' } : n) };
    set({ session, error: null, loading: !selected.expanded });
    if (selected.expanded) return;
    const requestedAt = new Date().toISOString();
    const input = {
      current_track_id: selected.track.id,
      session_path: activePath(session).map(n => n.track.id),
      explored_track_ids: session.nodes.map(n => n.track.id),
      limit: selected.depth === 0 ? 8 : 7,
    };
    try {
      const recommendations = await dependencies.recommendation.getRecommendations({
        currentTrackId: selected.track.id, sessionPath: input.session_path,
        exploredTrackIds: input.explored_track_ids, limit: input.limit, playlistContext: session.playlistContext,
      });
      const latest = get().session;
      if (token !== requestId || latest?.id !== session.id) return;
      const current = latest.nodes.find(n => n.nodeId === nodeId)!;
      const seen = new Set(latest.nodes.map(n => n.track.id));
      if (latest.datasetId === FMA40_DATASET_ID) {
        const ids = recommendations.map(item => item.track?.id);
        if (ids.some(id => !id || seen.has(id)) || new Set(ids).size !== ids.length || recommendations.length > input.limit) {
          set({ loading: false, error: 'Recommendation contract error. Start a new exploration.' });
          return;
        }
      }
      const unique = recommendations.filter(r => { if (!r.track?.id || !r.track.title || seen.has(r.track.id)) return false; seen.add(r.track.id); return true; }).slice(0, selected.depth === 0 ? 8 : 7);
      const positions = dependencies.placement.placeChildren({ parent: latest.nodes.find(n => n.nodeId === current.parentNodeId), current, count: unique.length, existingNodes: latest.nodes });
      const children: MusicGraphNode[] = unique.map((r, i) => ({
        nodeId: crypto.randomUUID(), track: r.track, parentNodeId: nodeId, depth: current.depth + 1,
        position: positions[i], state: 'recommendation', sharedGenreCount: r.sharedGenreCount,
      }));
      let cases = latest.cases;
      let origins = latest.nodeOriginCaseId;
      let caseId: string | undefined;
      if (latest.datasetId === FMA40_DATASET_ID) {
        caseId = crypto.randomUUID();
        const frozen: SessionCase = {
          case_id: caseId, participant_id: null, session_id: latest.id, requested_at: requestedAt, input,
          recommendations: unique.map((item, index) => ({
            rank: index + 1, track_id: item.track.id,
            shared_genre_count: item.sharedGenreCount ?? 0,
            union_genre_count: item.unionGenreCount ?? 1,
          })),
          presentation: { mode: 'graph_committed' },
        };
        cases = [...(latest.cases || []), frozen];
        origins = { ...(latest.nodeOriginCaseId || {}) };
        if (current.depth === 0) origins[current.nodeId] = caseId;
        for (const child of children) origins[child.nodeId] = caseId;
      }
      set({
        loading: false,
        session: {
          ...latest, cases, nodeOriginCaseId: origins,
          nodes: [...latest.nodes.map(n => n.nodeId === nodeId ? { ...n, expanded: true } : n), ...children],
          edges: [...latest.edges, ...children.map((n, i) => ({ id: `${nodeId}-${n.nodeId}`, sourceNodeId: nodeId, targetNodeId: n.nodeId, relation: unique[i].scores }))],
        },
        error: children.length ? null : 'You have reached the edge of this collection. Try a new song.',
      });
      get().emit('node_expand', current.track.id, undefined, current.nodeId);
    } catch { if (token === requestId) set({ loading: false, error: 'This direction could not load. Select the song again to retry.' }); }
  },
  move(nodeId, position) { const s = get().session; if (s) set({ session: { ...s, nodes: s.nodes.map(n => n.nodeId === nodeId ? { ...n, position } : n) } }); },
  clear() { ++requestId; set({ session: null, loading: false, error: null }); },
  emit(type, trackId, detail, nodeId) {
    const s = get().session;
    if (!s) return;
    const interaction = [...s.interactionEvents, { type, trackId, timestamp: new Date().toISOString(), detail }];
    let researchEvents = s.researchEvents;
    const allowed = new Set(['node_impression', 'node_expand', 'preview_start', 'preview_pause', 'preview_complete', 'like', 'save']);
    if (s.datasetId === FMA40_DATASET_ID && allowed.has(type) && (s.cases?.length || 0) > 0) {
      const caseId = resolveOriginCase(s, trackId, nodeId);
      if (caseId) {
        if (type === 'node_impression' && (researchEvents || []).some(event => event.type === 'node_impression' && event.case_id === caseId && event.track_id === trackId)) {
          set({ session: { ...s, interactionEvents: interaction } });
          return;
        }
        const event: SessionResearchEvent = {
          event_id: crypto.randomUUID(), session_id: s.id, case_id: caseId, track_id: trackId,
          occurred_at: new Date().toISOString(),
          type: type as SessionResearchEvent['type'],
          value: type === 'like' || type === 'save' ? detail !== 'removed' : null,
        };
        researchEvents = [...(researchEvents || []), event];
      }
    }
    set({ session: { ...s, interactionEvents: interaction, researchEvents } });
  },
  toggle(kind, trackId) { const list = get()[kind]; const removing = list.includes(trackId); set({ [kind]: removing ? list.filter(id => id !== trackId) : [...list, trackId] }); get().emit(kind === 'liked' ? 'like' : 'save', trackId, removing ? 'removed' : 'added'); },
}));
let persistTimer: ReturnType<typeof setTimeout>;
function persist() {
  const s = useExploration.getState();
  if (!s.ready) return;
  try { if (s.session) localStorage.setItem(STORAGE_KEY, JSON.stringify(s.session)); else localStorage.removeItem(STORAGE_KEY); localStorage.setItem('sonder.collection.v1', JSON.stringify({ liked: s.liked, saved: s.saved })); }
  catch { if (!s.storageError) useExploration.setState({ storageError: true }); }
}
if (typeof window !== 'undefined') {
  useExploration.subscribe((s, previous) => { if (s.session !== previous.session || s.liked !== previous.liked || s.saved !== previous.saved) { clearTimeout(persistTimer); persistTimer = setTimeout(persist, 180); } });
  window.addEventListener('pagehide', persist);
}
