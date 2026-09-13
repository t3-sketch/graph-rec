'use client';
import { memo, useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, useReactFlow, useNodesState, useNodesInitialized, getNodesBounds, type NodeChange } from '@xyflow/react';
import { Plus, Minus, Maximize, LocateFixed } from 'lucide-react';
import { useExploration } from '@/store/exploration';
import { createFloatingGraph } from '@/graph/floatingGraph';
import { createFilaments, routeFilaments } from '@/graph/filaments';
import { OrbitEdge } from './OrbitEdge';
import type { Point } from '@/domain/types';
import { activePath } from '@/graph/session';
import { SongNode, type SongFlowNode } from './SongNode';
const nodeTypes = { song: SongNode };
const edgeTypes = { orbit: OrbitEdge };
function Canvas() {
  const graphNodes = useExploration(s => s.session?.nodes);
  const graphEdges = useExploration(s => s.session?.edges);
  const currentId = useExploration(s => s.session?.activeNodeId);
  const sessionId = useExploration(s => s.session?.id);
  const pinned = useRef(new Map<string, { x: number; y: number }>());
  const dragging = useRef<string | null>(null);
  const graphElement = useRef<HTMLDivElement>(null);
  const fittedSession = useRef<string | null>(null);
  const expand = useExploration(s => s.expand);
  const move = useExploration(s => s.move);
  const { setCenter, fitView, fitBounds, zoomIn, zoomOut, getZoom, getNodes } = useReactFlow();
  const initialized = useNodesInitialized();
  const [routes, setRoutes] = useState(new Map<string, Point[]>());
  const [nodes, setNodes, onNodesChange] = useNodesState<SongFlowNode>([]);
  useEffect(() => {
    setNodes(old => {
      const oldById = new Map(old.map(n => [n.id,n]));
      return (graphNodes || []).map(song => {
      const existing = oldById.get(song.nodeId);
      if (existing?.data.song === song) return existing;
      return { ...existing, id: song.nodeId, type: 'song', position: existing?.position || song.position, data: { song }, ariaLabel: `Explore ${song.track.title} by ${song.track.artists.map(a => a.name).join(', ')}`, width: 144, height: 130 };
    }); });
  }, [graphNodes, setNodes]);
  useEffect(() => {
    if (!graphNodes?.length) return;
    const filaments = createFilaments(graphNodes, graphEdges || []);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const floating = createFloatingGraph(graphNodes, new Map(getNodes().map(n => [n.id, n.position])));
    let frame = 0, last = 0;
    function step(now: number) {
      frame = requestAnimationFrame(step);
      if (document.hidden || media.matches || now - last < 1000 / 60) return;
      last = now - ((now - last) % (1000 / 60));
      const positions = new Map(floating.tick(now, pinned.current).map(p => [p.id, { x: p.x!, y: p.y! }]));
      setRoutes(filaments.tick(positions));
      setNodes(old => old.map(n => n.dragging || pinned.current.has(n.id) ? n : { ...n, position: positions.get(n.id) || n.position }));
    }
    function motionPreference() {
      cancelAnimationFrame(frame);
      if (media.matches) {
        setRoutes(routeFilaments(graphNodes!, graphEdges || []));
        setNodes(old => old.map(n => n.dragging ? n : { ...n, position: n.data.song.position }));
      } else frame = requestAnimationFrame(step);
    }
    motionPreference();
    media.addEventListener('change', motionPreference);
    return () => { cancelAnimationFrame(frame); floating.stop(); filaments.stop(); media.removeEventListener('change', motionPreference); };
  }, [graphNodes, graphEdges, sessionId, setNodes, getNodes]);
  const recenter = useCallback(() => {
    const s = useExploration.getState().session;
    const current = s?.nodes.find(n => n.nodeId === s.activeNodeId);
    if (current) setCenter(current.position.x + 72, current.position.y + 50, { zoom: Math.min(getZoom(), 1), duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650 });
  }, [getZoom, setCenter]);
  useEffect(() => {
    let previousWidth = 0;
    let previousHeight = 0;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (previousWidth && (width !== previousWidth || height !== previousHeight)) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(recenter);
      }
      previousWidth = width; previousHeight = height;
    });
    if (graphElement.current) observer.observe(graphElement.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [recenter]);
  useEffect(() => {
    if (!initialized || !sessionId || !graphNodes?.length) return;
    if (fittedSession.current !== sessionId && graphNodes.length > 1) {
      fittedSession.current = sessionId;
      void fitBounds(getNodesBounds(useExploration.getState().session!.nodes.map(n => ({ id: n.nodeId, position: n.position, data: {}, width: 144, height: 130 }))), { padding: .18, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550 });
    }
  }, [initialized, sessionId, graphNodes?.length, fitBounds]);
  useEffect(() => { if (fittedSession.current === sessionId) recenter(); }, [currentId, sessionId, recenter]);
  const edges = useMemo(() => {
    const session = useExploration.getState().session;
    if (!session || !graphEdges) return [];
    const path = new Set(activePath(session).map(n => n.nodeId));
    return graphEdges.map(e => ({ id: e.id, source: e.sourceNodeId, target: e.targetNodeId, type: 'orbit', data: { offsets: routes.get(e.id) }, className: path.has(e.targetNodeId) ? 'path-edge' : e.sourceNodeId === session.activeNodeId ? 'candidate-edge' : 'quiet-edge' }));
  }, [graphEdges, routes, currentId]);
  const handleChanges = useCallback((changes: NodeChange<SongFlowNode>[]) => {
    onNodesChange(changes.filter(c => c.type !== 'remove'));
    for (const change of changes) if (change.type === 'position' && change.position) {
      pinned.current.set(change.id, change.position);
      if (change.dragging === false) move(change.id, change.position);
    }
  }, [onNodesChange, move]);
  return <>
    <ReactFlow<SongFlowNode> ref={graphElement} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={handleChanges}
      onNodeClick={(_, n) => void expand(n.id)}
      onNodeMouseEnter={(_, n) => pinned.current.set(n.id, n.position)}
      onNodeMouseLeave={(_, n) => { if (dragging.current !== n.id) pinned.current.delete(n.id); }}
      onNodeDragStart={(_, n) => { dragging.current = n.id; pinned.current.set(n.id, n.position); }}
      onNodeDragStop={(_, n) => { dragging.current = null; pinned.current.delete(n.id); }}
      onKeyDown={e => { if (e.key === 'Enter') { const id = (e.target as HTMLElement).closest('.react-flow__node')?.getAttribute('data-id'); if (id) { e.preventDefault(); void expand(id); } } }}
      minZoom={.2} maxZoom={1.8} defaultViewport={{ x: 0, y: 0, zoom: .94 }} nodesConnectable={false} edgesFocusable={false} deleteKeyCode={null}
      panOnScroll zoomOnScroll={false} zoomOnPinch zoomOnDoubleClick={false} preventScrolling panOnDrag nodeDragThreshold={5} colorMode="dark"
      aria-label="Interactive song exploration graph" fitView fitViewOptions={{ padding: .28, maxZoom: 1 }}>
      <Background color="#77866e" gap={43} size={.55} />
    </ReactFlow>
    <div className="graph-controls"><button onClick={() => zoomIn()} aria-label="Zoom in" title="Zoom in"><Plus size={16}/></button><button onClick={() => zoomOut()} aria-label="Zoom out" title="Zoom out"><Minus size={16}/></button><span/><button onClick={() => fitView({ padding: .2, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550 })} aria-label="Fit entire graph" title="Fit entire graph"><Maximize size={16}/></button><button onClick={recenter} aria-label="Center active song" title="Center active song"><LocateFixed size={17}/></button></div>
  </>;
}
export const MusicGraph = memo(function MusicGraph() { return <ReactFlowProvider><Canvas /></ReactFlowProvider>; });
