import type { GraphPlacementStrategy, Point } from '@/domain/types';
export class DirectionalPlacementStrategy implements GraphPlacementStrategy {
  placeChildren({ parent, current, count, existingNodes }: Parameters<GraphPlacementStrategy['placeChildren']>[0]): Point[] {
    const heading = parent ? Math.atan2(current.position.y - parent.position.y, current.position.x - parent.position.x) : -Math.PI / 2;
    const placed: Point[] = [];
    const occupied = existingNodes.map(n => n.position);
    // ponytail: linear collision scan is ample for 500 nodes; use a spatial index if measured expansion latency grows.
    for (let i = 0; i < count; i++) {
      const angle = parent ? heading - Math.PI * .43 + (count === 1 ? Math.PI * .43 : i / (count - 1) * Math.PI * .86) : heading + i * Math.PI * 2 / count + Math.sin(i * 2.399) * .13;
      let radius = parent ? 290 + (i % 2) * 80 : 255 + (i % 3) * 31;
      let point: Point;
      do {
        point = { x: current.position.x + Math.cos(angle) * radius, y: current.position.y + Math.sin(angle) * radius * (parent ? 1 : .78) };
        radius += 32;
      } while (occupied.some(p => Math.abs(p.x - point.x) < 152 && Math.abs(p.y - point.y) < 146));
      placed.push(point);
      occupied.push(point);
    }
    return placed;
  }
}
