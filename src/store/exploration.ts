import { create } from 'zustand';
import type { ExplorationSession, Track, Point, InteractionEvent, MusicGraphNode } from '@/domain/types';
import { activePath, restoreSession, STORAGE_KEY } from '@/graph/session';
import { dependencies } from '@/services/dependencies';

type State = {
  session: ExplorationSession | null; ready: boolean; loading: boolean; error: string | null; storageError: boolean;
  liked: string[]; saved: string[];
  initialize(): void; start(track: Track, playlistContext?: ExplorationSession['playlistContext']): Promise<void>;
  expand(nodeId: string): Promise<void>; move(nodeId: string, position: Point): void; clear(): void;
  emit(type: InteractionEvent, trackId: string, detail?: string): void; toggle(kind: 'liked' | 'saved', trackId: string): void;
};
let requestId = 0;
export const useExploration = create<State>((set, get) => ({
  session: null, ready: false, loading: false, error: null, storageError: false, liked: [], saved: [],
  initialize() {
    if (get().ready) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const session = restoreSession(raw);
      let collection: { liked?: unknown; saved?: unknown } = {};
      try { collection = JSON.parse(localStorage.getItem('sonder.collection.v1') || '{}') || {}; } catch { /* The graph is independent of collection recovery. */ }
      set({ ready: true, session, error: raw && !session ? 'The saved map could not be restored. Start a new exploration.' : null,
        liked: Array.isArray(collection.liked) ? collection.liked.filter((x: unknown) => typeof x === 'string') : [], saved: Array.isArray(collection.saved) ? collection.saved.filter((x: unknown) => typeof x === 'string') : [] });
    } catch { set({ ready: true, storageError: true }); }
  },
  async start(track, playlistContext) {
    ++requestId;
    const node: MusicGraphNode = { nodeId: crypto.randomUUID(), track, depth: 0, position: { x: 0, y: 0 }, state: 'active' };
    set({ session: { id: crypto.randomUUID(), startedAt: new Date().toISOString(), seedTrackId: track.id, activeNodeId: node.nodeId, nodes: [node], edges: [], interactionEvents: [], playlistContext }, loading: false, error: null });
    await get().expand(node.nodeId);
  },
  async expand(nodeId) {
    const initial = get().session;
    if (!initial) return;
    const selected = initial.nodes.find(n => n.nodeId === nodeId);
    if (!selected) return;
    // A new selection supersedes an in-flight request, including when returning to an explored branch.
    const token = ++requestId;
    const session: ExplorationSession = { ...initial, activeNodeId: nodeId, nodes: initial.nodes.map(n => n.nodeId === nodeId ? { ...n, state: 'active' } : n.state === 'active' ? { ...n, state: n.depth === 0 ? 'seed' : 'explored' } : n) };
    set({ session, error: null, loading: !selected.expanded });
    if (selected.expanded) return;
    try {
      const recommendations = await dependencies.recommendation.getRecommendations({ currentTrackId: selected.track.id, sessionPath: activePath(session).map(n => n.track.id), exploredTrackIds: session.nodes.map(n => n.track.id), limit: selected.depth === 0 ? 8 : 7, playlistContext: session.playlistContext });
      const latest = get().session;
      if (token !== requestId || latest?.id !== session.id) return;
      const current = latest.nodes.find(n => n.nodeId === nodeId)!;
      const seen = new Set(latest.nodes.map(n => n.track.id));
      const unique = recommendations.filter(r => { if (!r.track?.id || !r.track.title || seen.has(r.track.id)) return false; seen.add(r.track.id); return true; }).slice(0, selected.depth === 0 ? 8 : 7);
      const positions = dependencies.placement.placeChildren({ parent: latest.nodes.find(n => n.nodeId === current.parentNodeId), current, count: unique.length, existingNodes: latest.nodes });
      const children: MusicGraphNode[] = unique.map((r, i) => ({ nodeId: crypto.randomUUID(), track: r.track, parentNodeId: nodeId, depth: current.depth + 1, position: positions[i], state: 'recommendation' }));
      set({ loading: false, session: { ...latest, nodes: [...latest.nodes.map(n => n.nodeId === nodeId ? { ...n, expanded: true } : n), ...children], edges: [...latest.edges, ...children.map((n, i) => ({ id: `${nodeId}-${n.nodeId}`, sourceNodeId: nodeId, targetNodeId: n.nodeId, relation: unique[i].scores }))] }, error: children.length ? null : 'You have reached the edge of this collection. Try a new song.' });
      get().emit('node_expand', current.track.id);

    } catch { if (token === requestId) set({ loading: false, error: 'This direction could not load. Select the song again to retry.' }); }
  },
  move(nodeId, position) { const s = get().session; if (s) set({ session: { ...s, nodes: s.nodes.map(n => n.nodeId === nodeId ? { ...n, position } : n) } }); },
  clear() { ++requestId; set({ session: null, loading: false, error: null }); },
  emit(type, trackId, detail) { const s = get().session; if (s) set({ session: { ...s, interactionEvents: [...s.interactionEvents, { type, trackId, timestamp: new Date().toISOString(), detail }] } }); },
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
