import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useExploration } from '../src/store/exploration';
import { dependencies } from '../src/services/dependencies';
import { activePath, restoreSession } from '../src/graph/session';
import { DirectionalPlacementStrategy } from '../src/graph/placement';
import { tracks } from '../src/mocks/tracks';
import type { RecommendedTrack, RecommendationContext } from '../src/domain/types';

test('complete exploration, branches, dragging, serialization, pluggability and stale responses', async () => {
  const original = dependencies.recommendation;
  const contexts: RecommendationContext[] = [];
  dependencies.recommendation = { async getRecommendations(c) { contexts.push(c); return tracks.filter(t => !c.exploredTrackIds.includes(t.id)).slice(0,c.limit).map(track => ({track})); } };
  try {
    await useExploration.getState().start(tracks[0]);
    let s = useExploration.getState().session!;
    assert.equal(s.nodes.length,9); assert.equal(s.edges.length,8);
    const seed = s.nodes[0], a = s.nodes[1], b = s.nodes[2];
    await useExploration.getState().expand(a.nodeId);
    s = useExploration.getState().session!;
    assert.equal(s.nodes.length,16);
    assert.deepEqual(activePath(s).map(n => n.nodeId),[seed.nodeId,a.nodeId]);
    assert.deepEqual(contexts.at(-1)?.sessionPath,[seed.track.id,a.track.id]);
    assert.equal(contexts.at(-1)?.exploredTrackIds.length,9);
    const children = s.nodes.filter(n => n.parentNodeId === a.nodeId);
    assert.equal(children.length,7);
    for (const n of children) assert.ok((n.position.x-a.position.x)*(a.position.x-seed.position.x)+(n.position.y-a.position.y)*(a.position.y-seed.position.y) > 0);
    await useExploration.getState().expand(b.nodeId);
    s = useExploration.getState().session!;
    assert.equal(s.nodes.length,23); assert.ok(s.nodes.some(n => n.nodeId === a.nodeId));
    assert.deepEqual(activePath(s).map(n => n.nodeId),[seed.nodeId,b.nodeId]);
    await useExploration.getState().expand(a.nodeId);
    assert.equal(useExploration.getState().session!.nodes.length,23);
    useExploration.getState().move(a.nodeId,{x:1999,y:2222});
    assert.deepEqual(useExploration.getState().session!.nodes.find(n => n.nodeId === a.nodeId)!.position,{x:1999,y:2222});
    s = useExploration.getState().session!;
    assert.deepEqual(restoreSession(JSON.stringify(s)),JSON.parse(JSON.stringify(s)));
    assert.equal(restoreSession('{bad'),null);
    assert.equal(restoreSession(JSON.stringify({...s,nodes:[{...s.nodes[0],position:{x:'wrong',y:0}}]})),null);
    assert.ok(!s.interactionEvents.some(e => e.type === 'like'));
    useExploration.getState().toggle('liked',a.track.id);
    assert.ok(useExploration.getState().session!.interactionEvents.some(e => e.type === 'like'));
    let resolve!: (r: RecommendedTrack[]) => void;
    dependencies.recommendation = { getRecommendations: () => new Promise(r => { resolve = r; }) };
    const pending = useExploration.getState().expand(children[0].nodeId);
    await useExploration.getState().expand(seed.nodeId);
    resolve([{track:tracks[80]}]); await pending;
    assert.equal(useExploration.getState().session!.activeNodeId,seed.nodeId);
    assert.equal(useExploration.getState().session!.nodes.length,23);
    dependencies.recommendation = { async getRecommendations() { throw new Error('offline'); } };
    await useExploration.getState().expand(children[0].nodeId);
    assert.match(useExploration.getState().error!,/retry/);
    assert.equal(useExploration.getState().loading,false);
    useExploration.getState().clear(); assert.equal(useExploration.getState().session,null);
  } finally { dependencies.recommendation = original; }
});

test('deterministic collision-free directional placement at 500 nodes', () => {
  const placement = new DirectionalPlacementStrategy();
  const nodes = [{nodeId:'0',track:tracks[0],depth:0,position:{x:0,y:0},state:'seed' as const}];
  const start = performance.now();
  while(nodes.length < 500) {
    const current = nodes.at(-1)!;
    const positions = placement.placeChildren({ current,parent:nodes.length > 1 ? nodes[nodes.length-2] : undefined,count:7,existingNodes:nodes });
    assert.deepEqual(positions,placement.placeChildren({ current,parent:nodes.length > 1 ? nodes[nodes.length-2] : undefined,count:7,existingNodes:nodes }));
    for (const p of positions) {
      assert.ok(nodes.every(n => Math.abs(n.position.x-p.x) >= 152 || Math.abs(n.position.y-p.y) >= 146));
      nodes.push({nodeId:String(nodes.length),track:tracks[nodes.length],depth:1,position:p,state:'seed'});
    }
  }
  console.log(`500-node placement check: ${Math.round(performance.now()-start)}ms`);
});


test('floating graph moves continuously, honors pins and leaves saved anchors untouched', async () => {
  const { createFloatingGraph } = await import('../src/graph/floatingGraph');
  const nodes = [0,1,2].map(i => ({ nodeId: String(i), track: tracks[i], depth: 0, position: { x: i * 180, y: 0 }, state: 'seed' as const }));
  const before = JSON.stringify(nodes);
  const floating = createFloatingGraph(nodes, new Map());
  const pinned = new Map([['0', { x: 0, y: 0 }]]);
  for (let i = 0; i < 180; i++) floating.tick(i * 16.67, pinned);
  const first = floating.particles.map(p => ({ x: p.x!, y: p.y! }));
  for (let i = 180; i < 360; i++) floating.tick(i * 16.67, pinned);
  assert.deepEqual({ x: floating.particles[0].x, y: floating.particles[0].y }, { x: 0, y: 0 });
  assert.ok(Math.hypot(floating.particles[1].x! - first[1].x, floating.particles[1].y! - first[1].y) > 5);
  assert.ok(floating.particles.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.hypot(p.x!-p.target.x,p.y!-p.target.y) < 80));
  assert.equal(JSON.stringify(nodes), before);
  floating.stop();
});

test('filament routing separates coincident strands without changing graph anchors', async () => {
  const { routeFilaments } = await import('../src/graph/filaments');
  const nodes = [0,1].map(i => ({ nodeId: String(i), track: tracks[i], depth: 0, position: { x: i * 400, y: 0 }, state: 'seed' as const }));
  const before = JSON.stringify(nodes);
  const routes = routeFilaments(nodes, [{ id: 'a', sourceNodeId: '0', targetNodeId: '1' }, { id: 'b', sourceNodeId: '0', targetNodeId: '1' }]);
  assert.equal(routes.get('a')?.length, 3);
  const a = routes.get('a')![1], b = routes.get('b')![1];
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y) > 25);
  assert.deepEqual(routes, routeFilaments(nodes, [{ id: 'a', sourceNodeId: '0', targetNodeId: '1' }, { id: 'b', sourceNodeId: '0', targetNodeId: '1' }]));
  assert.equal(JSON.stringify(nodes), before);
});
