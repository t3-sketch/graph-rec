import type { ExplorationSession, MusicGraphNode, SessionBuildProvenance } from '@/domain/types';
import { FMA40_DATASET_ID, FMA40_PROVIDER_ID } from '@/catalog/fma40';
import { PROVENANCE } from '@/research-export/provenance.generated';
export function activePath(session: ExplorationSession): MusicGraphNode[] {
  const byId = new Map(session.nodes.map(n => [n.nodeId, n]));
  const result: MusicGraphNode[] = [];
  let node = byId.get(session.activeNodeId);
  const visited = new Set<string>();
  while (node && !visited.has(node.nodeId)) { result.unshift(node); visited.add(node.nodeId); node = node.parentNodeId ? byId.get(node.parentNodeId) : undefined; }
  return result;
}
export const STORAGE_KEY = 'sonder.exploration.v2';
export function currentBuildProvenance(): SessionBuildProvenance {
  return {
    catalog_sha256: PROVENANCE.catalog_sha256,
    commit: PROVENANCE.commit,
    dirty: PROVENANCE.dirty,
    source_files: { ...PROVENANCE.source_files },
  };
}
function sourceFilesMatch(saved: Record<string, string>, current: Record<string, string>): boolean {
  const keys = Object.keys(current);
  return keys.length === Object.keys(saved).length && keys.every(key => saved[key] === current[key]);
}
export function isCurrentBuildSession(session: ExplorationSession): boolean {
  const saved = session.buildProvenance;
  if (!saved || saved.catalog_sha256 !== PROVENANCE.catalog_sha256) return false;
  return sourceFilesMatch(saved.source_files, PROVENANCE.source_files);
}
export function isFmaDemoSession(session: ExplorationSession): boolean {
  return session.datasetId === FMA40_DATASET_ID && session.providerId === FMA40_PROVIDER_ID && Array.isArray(session.cases) && isCurrentBuildSession(session);
}
export function isLegacyCatalogSession(session: ExplorationSession): boolean {
  const ids = [session.seedTrackId, ...session.nodes.map(n => n.track.id)];
  if (ids.some(id => id.startsWith('sonder-'))) return true;
  if (ids.some(id => id.startsWith('fma-')) && !isFmaDemoSession(session)) return true;
  return false;
}
export function restoreSession(raw: string | null): ExplorationSession | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s.id !== 'string' || typeof s.startedAt !== 'string' || typeof s.seedTrackId !== 'string' || typeof s.activeNodeId !== 'string' || !Array.isArray(s.nodes) || !s.nodes.length || s.nodes.length > 2000 || !Array.isArray(s.edges) || !Array.isArray(s.interactionEvents)) return null;
    const validTrack = (t: Record<string, unknown>) => t && typeof t.id === 'string' && typeof t.title === 'string' && Array.isArray(t.artists) && t.artists.length > 0 && t.artists.every(a => a && typeof a.name === 'string');
    if (!s.nodes.every((n: MusicGraphNode) => n && typeof n.nodeId === 'string' && validTrack(n.track) && Number.isFinite(n.position?.x) && Number.isFinite(n.position?.y) && Number.isInteger(n.depth) && ['seed','explored','active','recommendation'].includes(n.state) && (n.expanded === undefined || typeof n.expanded === 'boolean'))) return null;
    const ids = new Set(s.nodes.map((n: MusicGraphNode) => n.nodeId));
    if (ids.size !== s.nodes.length || !ids.has(s.activeNodeId) || !s.nodes.some((n: MusicGraphNode) => n.track.id === s.seedTrackId)) return null;
    if (!s.nodes.every((n: MusicGraphNode) => !n.parentNodeId || ids.has(n.parentNodeId))) return null;
    if (!s.edges.every((e: ExplorationSession['edges'][number]) => typeof e.id === 'string' && ids.has(e.sourceNodeId) && ids.has(e.targetNodeId))) return null;
    for (const node of s.nodes as MusicGraphNode[]) {
      const path = activePath({ ...s, activeNodeId: node.nodeId });
      if (path.length !== node.depth + 1 || path[0].parentNodeId || path[0].track.id !== s.seedTrackId) return null;
    }
    if (!s.interactionEvents.every((e: ExplorationSession['interactionEvents'][number]) => e && typeof e.type === 'string' && typeof e.trackId === 'string' && typeof e.timestamp === 'string')) return null;
    if (s.cases !== undefined && !Array.isArray(s.cases)) return null;
    if (s.researchEvents !== undefined && !Array.isArray(s.researchEvents)) return null;
    if (s.buildProvenance !== undefined) {
      const provenance = s.buildProvenance;
      if (!provenance || typeof provenance !== 'object' || typeof provenance.catalog_sha256 !== 'string' || provenance.source_files === null || typeof provenance.source_files !== 'object' || Array.isArray(provenance.source_files)) return null;
    }
    return s as ExplorationSession;
  } catch { return null; }
}
