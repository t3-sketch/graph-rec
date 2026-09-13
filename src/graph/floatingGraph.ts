import { forceCollide, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
import type { MusicGraphNode, Point } from '@/domain/types';
type Particle = SimulationNodeDatum & { id: string; target: Point; phase: number };

// Render positions float around saved anchors. D3 never mutates session data.
export function createFloatingGraph(nodes: MusicGraphNode[], rendered: Map<string, Point>) {
  const byId = new Map(nodes.map(n => [n.nodeId, n]));
  const particles: Particle[] = nodes.map(n => {
    const origin = rendered.get(n.nodeId) || (rendered.size ? byId.get(n.parentNodeId || '')?.position : undefined) || n.position;
    const phase = [...n.nodeId].reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return { id: n.nodeId, target: { ...n.position }, phase, x: origin.x, y: origin.y };
  });
  const x = forceX<Particle>().strength(.065), y = forceY<Particle>().strength(.065);
  const simulation = forceSimulation(particles).stop().alpha(.45).alphaDecay(0).velocityDecay(.58)
    .force('x', x).force('y', y)
    .force('charge', forceManyBody<Particle>().strength(-45).distanceMax(190))
    .force('collision', forceCollide<Particle>(68).strength(.8).iterations(2));
  return {
    particles,
    stop: () => simulation.stop(),
    tick(time: number, pinned: Map<string, Point>) {
      x.x(p => p.target.x + Math.sin(time * .00065 + p.phase) * 28);
      y.y(p => p.target.y + Math.cos(time * .00051 + p.phase * 1.7) * 32);
      for (const p of particles) { const fixed = pinned.get(p.id); p.fx = fixed?.x ?? null; p.fy = fixed?.y ?? null; }
      simulation.tick();
      return particles;
    },
  };
}
