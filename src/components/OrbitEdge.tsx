import { memo } from 'react';
import { BaseEdge, type EdgeProps, type Edge } from '@xyflow/react';
import type { Point } from '@/domain/types';
type FilamentEdge = Edge<{ offsets?: Point[] }>;
export const OrbitEdge = memo(function OrbitEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<FilamentEdge>) {
  const dx = targetX - sourceX, dy = targetY - sourceY;
  const distance = Math.hypot(dx, dy) || 1;
  const bend = Math.min(30, distance * .09) * (id.charCodeAt(0) % 2 ? 1 : -1);
  const points = [.25, .5, .75].map((t, i) => ({
    x: sourceX + dx * t + (data?.offsets?.[i]?.x || 0) - dy / distance * bend * Math.sin(t * Math.PI),
    y: sourceY + dy * t + (data?.offsets?.[i]?.y || 0) + dx / distance * bend * Math.sin(t * Math.PI),
  }));
  const [a, b, c] = points;
  const path = `M${sourceX},${sourceY} Q${a.x},${a.y} ${(a.x+b.x)/2},${(a.y+b.y)/2} Q${b.x},${b.y} ${(b.x+c.x)/2},${(b.y+c.y)/2} Q${c.x},${c.y} ${targetX},${targetY}`;
  return <>
    <path d={path} className="filament-clearance" fill="none" strokeWidth={5} />
    <BaseEdge id={id} path={path} interactionWidth={0}/>
  </>;
});
