'use client';
import { useEffect, useState } from 'react';
import { AudioLines, Compass, History, ListMusic, Plus, ArrowUpRight, Headphones, UserRound, Sparkles } from 'lucide-react';
import { TrackInspector } from './TrackInspector';
import { MiniPlayer } from './MiniPlayer';
import { LibraryPanel, type Panel } from './LibraryPanel';
import { activePath } from '@/graph/session';
import { MusicGraph } from './MusicGraph';
import { MusicSearch } from './MusicSearch';
import { Artwork } from './Artwork';
import { tracks } from '@/mocks/tracks';
import { useExploration } from '@/store/exploration';
export function Explorer() {
  const [panel,setPanel] = useState<Panel>(null); const [hiddenInspector,setHiddenInspector] = useState<string | null>(null);
  const loading = useExploration(s => s.loading); const error = useExploration(s => s.error); const storageError = useExploration(s => s.storageError);
  const session = useExploration(s => s.session); const ready = useExploration(s => s.ready); const initialize = useExploration(s => s.initialize); const start = useExploration(s => s.start);
  const active = session?.nodes.find(n => n.nodeId === session.activeNodeId);
  useEffect(() => { initialize(); }, [initialize]);
  return <main className="app-shell"><aside className="rail"><a href="/" className="brand-mark" aria-label="Sonder home"><AudioLines size={26}/></a><nav><button className="rail-button selected" aria-label="Explore" title="Explore" onClick={() => setPanel(null)}><Compass size={21}/></button><button className="rail-button" aria-label="History" title="History & saved songs" onClick={() => setPanel('history')}><History size={21}/></button><button className="rail-button" aria-label="Playlists" title="Your playlists" onClick={() => setPanel('playlists')}><ListMusic size={21}/></button></nav><span className="rail-bottom"><Headphones size={19}/></span></aside>
    <div className="workspace"><header className="topbar"><a className="wordmark" href="/">sonder<span> / </span><small>explore</small></a><MusicSearch/><button className="account-button" aria-label="Connected music services" onClick={() => setPanel('services')}><UserRound size={16}/><span>Your space</span><span className="avatar">S</span></button></header>
    <section className={`exploration ${!active || hiddenInspector === active.nodeId ? 'inspector-hidden' : ''}`}><div className="canvas-heading"><div><div className="eyebrow"><span className="live-dot"/> A LITTLE CURIOSITY GOES A LONG WAY</div><h1>Music, in every direction.</h1><p>Find a song. Follow a feeling. See where it takes you.</p></div><button className="subtle-button" onClick={() => useExploration.getState().clear()}><Plus size={16}/>New exploration</button></div>
      <div className="graph-region"><MusicGraph/>{!session && ready && <div className="start-card"><div className="eyebrow"><Sparkles size={13}/> YOUR NEXT FAVORITE IS OUT THERE</div><button className="starter-art" onClick={() => void start(tracks[0])} aria-label="Start exploring Neon Horizon"><Artwork track={tracks[0]}/><span><ArrowUpRight size={28}/></span></button><h2>A song is just the beginning.</h2><p>Search for something you love, or step into<br/>a new world with Neon Horizon by Aster.</p><button className="primary-button" onClick={() => void start(tracks[0])}>Start exploring <ArrowUpRight size={16}/></button><small>Fictional songs. Real possibilities.</small></div>}</div>
      {active && hiddenInspector !== active.nodeId && <TrackInspector track={active.track} onClose={() => setHiddenInspector(active.nodeId)}/>}
      {active && hiddenInspector === active.nodeId && <button className="show-inspector subtle-button" onClick={() => setHiddenInspector(null)}>Song details <ArrowUpRight size={14}/></button>}
      {session && <div className="path-breadcrumb" aria-label="Current exploration path">{activePath(session).map((n,i) => <span key={n.nodeId}>{i > 0 && <span className="path-divider">/</span>}<button className={n.nodeId === session.activeNodeId ? 'current' : ''} onClick={() => void useExploration.getState().expand(n.nodeId)}>{n.track.title}</button></span>)}</div>}
      <div className="graph-message" role="status" aria-live="polite">{loading ? <><span className="loading-dot"/>Finding your next direction…</> : error || (storageError ? 'Browser storage unavailable. This map will last until you leave.' : '')}</div>
      <footer className="canvas-footer"><span><span className="live-dot"/>{session ? `${session.nodes.length} songs in your universe` : 'An open space for discovery'}</span><span>Drag to wander <b>·</b> Pinch to zoom <b>·</b> Click to explore</span></footer>
    </section><MiniPlayer/></div><LibraryPanel panel={panel} onClose={() => setPanel(null)}/></main>;
}
