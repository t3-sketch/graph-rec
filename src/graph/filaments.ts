import { forceCollide, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
import type { MusicGraphEdge, MusicGraphNode, Point } from '@/domain/types';
type Bead = SimulationNodeDatum & { anchor: Point; radius: number; nodeId?: string; edgeId?: string; source?: string; target?: string; t: number };

// Soft routing, not a planar-graph solver: fixed endpoints can still force crossings.
export function createFilaments(nodes: MusicGraphNode[], edges: MusicGraphEdge[]) {
  const positions = new Map(nodes.map(n => [n.nodeId, n.position]));
  const beads: Bead[] = nodes.map(n => ({ anchor: { ...n.position }, nodeId: n.nodeId, radius: 48, t: 0 }));
  for (const e of edges) if (positions.has(e.sourceNodeId) && positions.has(e.targetNodeId)) {
    for (const t of [.25, .5, .75]) beads.push({ anchor: { x: 0, y: 0 }, radius: 22, edgeId: e.id, source: e.sourceNodeId, target: e.targetNodeId, t });
  }
  function anchor(next: Map<string, Point>) {
    for (const p of beads) {
      if (p.nodeId) {
        const n = next.get(p.nodeId)!;
        p.fx = n.x + 72; p.fy = n.y + 38;
      } else {
        const a = next.get(p.source!)!, b = next.get(p.target!)!;
        p.anchor = { x: a.x + (b.x-a.x)*p.t + 72, y: a.y + (b.y-a.y)*p.t + 38 };
      }
    }
  }
  anchor(positions);
  for (const p of beads) { p.x = p.fx ?? p.anchor.x; p.y = p.fy ?? p.anchor.y; }
  const x = forceX<Bead>(p => p.anchor.x).strength(.12), y = forceY<Bead>(p => p.anchor.y).strength(.12);
  const simulation = forceSimulation(beads).stop().alpha(.55).alphaDecay(0).velocityDecay(.65)
    .force('x', x).force('y', y)
    .force('collide', forceCollide<Bead>(p => p.radius).strength(1).iterations(2));
  return {
    stop: () => simulation.stop(),
    tick(next: Map<string, Point>, iterations = 1) {
      anchor(next); x.x(p => p.anchor.x); y.y(p => p.anchor.y);
      simulation.tick(iterations);
      const offsets = new Map<string, Point[]>();
      for (const p of beads) if (p.edgeId) {
        const points = offsets.get(p.edgeId) || [];
        points.push({ x: p.x! - p.anchor.x, y: p.y! - p.anchor.y });
        offsets.set(p.edgeId, points);
      }
      return offsets;
    },
  };
}

export function routeFilaments(nodes: MusicGraphNode[], edges: MusicGraphEdge[]) {
  const filaments = createFilaments(nodes, edges);
  const routes = filaments.tick(new Map(nodes.map(n => [n.nodeId, n.position])), 45);
  filaments.stop();
  return routes;
}
