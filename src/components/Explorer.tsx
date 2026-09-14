'use client';
import { useEffect, useState } from 'react';
import { AudioLines, Compass, History, Plus, ArrowUpRight, Headphones, Download, Sparkles } from 'lucide-react';
import { TrackInspector } from './TrackInspector';
import { MiniPlayer } from './MiniPlayer';
import { LibraryPanel, type Panel } from './LibraryPanel';
import { activePath } from '@/graph/session';
import { MusicGraph } from './MusicGraph';
import { MusicSearch } from './MusicSearch';
import { Artwork } from './Artwork';
import { startTracks } from '@/catalog/fma40';
import { useExploration } from '@/store/exploration';
import { downloadBundleJson, exportSessionBundle } from '@/research-export/sessionExport';
export function Explorer() {
  const [panel,setPanel] = useState<Panel>(null); const [hiddenInspector,setHiddenInspector] = useState<string | null>(null);
  const [exportError, setExportError] = useState('');
  const loading = useExploration(s => s.loading); const error = useExploration(s => s.error); const storageError = useExploration(s => s.storageError);
  const session = useExploration(s => s.session); const ready = useExploration(s => s.ready); const initialize = useExploration(s => s.initialize); const start = useExploration(s => s.start);
  const active = session?.nodes.find(n => n.nodeId === session.activeNodeId);
  const canExport = Boolean(session?.cases?.length);
  useEffect(() => { initialize(); }, [initialize]);
  async function exportSession() {
    if (!session?.cases?.length) { setExportError('Explore at least one song before exporting.'); return; }
    try {
      const bundle = await exportSessionBundle(session);
      downloadBundleJson(bundle);
      setExportError('');
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : 'Export failed.');
    }
  }
  return <main className="app-shell"><aside className="rail"><a href="/" className="brand-mark" aria-label="Sonder home"><AudioLines size={26}/></a><nav><button className="rail-button selected" aria-label="Explore" title="Explore" onClick={() => setPanel(null)}><Compass size={21}/></button><button className="rail-button" aria-label="History" title="History & saved songs" onClick={() => setPanel('history')}><History size={21}/></button></nav><span className="rail-bottom"><Headphones size={19}/></span></aside>
    <div className="workspace"><header className="topbar"><a className="wordmark" href="/">sonder<span> / </span><small>explore</small></a><MusicSearch/></header>
    <section className={`exploration ${!active || hiddenInspector === active.nodeId ? 'inspector-hidden' : ''}`}><div className="canvas-heading"><div><div className="eyebrow"><span className="live-dot"/> A LITTLE CURIOSITY GOES A LONG WAY</div><h1>Music, in every direction.</h1><p>Forty CC songs. Follow a branch and hear the excerpt.</p></div><span className="heading-actions"><button className="subtle-button" disabled={!canExport} title={canExport ? 'Download a frozen research bundle' : 'Explore first, then export'} onClick={() => void exportSession()}><Download size={16}/>Export session</button><button className="subtle-button" onClick={() => useExploration.getState().clear()}><Plus size={16}/>New exploration</button></span></div>
      <div className="graph-region"><MusicGraph/>{!session && ready && <div className="start-card"><div className="eyebrow"><Sparkles size={13}/> THREE DOORS INTO THE SAME MAP</div><div className="start-seeds">{startTracks.map(track => <button key={track.id} className="starter-art" onClick={() => void start(track)} aria-label={`Start exploring ${track.title}`}><Artwork track={track}/><span><ArrowUpRight size={22}/></span><small>{track.genreNames?.[0]}</small></button>)}</div><h2>A song is just the beginning.</h2><p>Start from Electronic, Folk, or Rock. Candidates come from shared genres, not a handwritten list.</p><button className="primary-button" onClick={() => void start(startTracks[0])}>Start with {startTracks[0].title} <ArrowUpRight size={16}/></button><small>FMA excerpts, used as provided. 40-song demo catalog.</small></div>}</div>
      {active && hiddenInspector !== active.nodeId && <TrackInspector track={active.track} onClose={() => setHiddenInspector(active.nodeId)}/>}
      {active && hiddenInspector === active.nodeId && <button className="show-inspector subtle-button" onClick={() => setHiddenInspector(null)}>Song details <ArrowUpRight size={14}/></button>}
      {session && <div className="path-breadcrumb" aria-label="Current exploration path">{activePath(session).map((n,i) => <span key={n.nodeId}>{i > 0 && <span className="path-divider">/</span>}<button className={n.nodeId === session.activeNodeId ? 'current' : ''} onClick={() => void useExploration.getState().expand(n.nodeId)}>{n.track.title}</button></span>)}</div>}
      <div className="graph-message" role="status" aria-live="polite">{loading ? <><span className="loading-dot"/>Finding your next direction…</> : exportError || error || (storageError ? 'Browser storage unavailable. This map will last until you leave.' : '')}</div>
      <footer className="canvas-footer"><span><span className="live-dot"/>{session ? `${session.nodes.length} songs in your universe` : 'An open space for discovery'} <b>·</b> <a href="/CREDITS.md" target="_blank" rel="noopener noreferrer">Credits</a></span><span>Drag to wander <b>·</b> Pinch to zoom <b>·</b> Click to explore</span></footer>
    </section><MiniPlayer/></div><LibraryPanel panel={panel} onClose={() => setPanel(null)}/></main>;
}
