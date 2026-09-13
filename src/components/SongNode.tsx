import { memo, useEffect, useRef } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { MusicGraphNode } from '@/domain/types';
import { useExploration } from '@/store/exploration';
import { Artwork } from './Artwork';
export type SongFlowNode = Node<{ song: MusicGraphNode }, 'song'>;
export const SongNode = memo(function SongNode({ data }: NodeProps<SongFlowNode>) {
  const { song } = data;
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { useExploration.getState().emit('node_impression', song.track.id); observer.disconnect(); }
    }, { root: element.current?.closest('.react-flow'), threshold: .5 });
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, [song.nodeId, song.track.id]);
  return <><Handle type="target" position={Position.Left} /><Handle type="source" position={Position.Right} /><div ref={element} className={`song-node ${song.state}`}>
    <div className="node-art"><Artwork track={song.track} />{song.state === 'active' && <span className="node-status"><i /><i /><i /></span>}</div>
    <strong>{song.track.title}</strong><span className="node-artist">{song.track.artists.map(a => a.name).join(', ')}</span>
    {song.depth === 0 && <span className="seed-marker">STARTING POINT</span>}
    <span className="node-hint">{song.expanded ? 'Return to this song' : 'Explore this direction ↗'}</span>
  </div></>;
});
