'use client';
import { useEffect, useRef } from 'react';
import { X, ArrowUpRight, Bookmark, History } from 'lucide-react';
import { useExploration } from '@/store/exploration';
import { activePath } from '@/graph/session';
import { fmaById } from '@/catalog/fma40';
import { Artwork } from './Artwork';
export type Panel = 'history' | null;
export function LibraryPanel({ panel, onClose }: { panel: Panel; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const session = useExploration(s => s.session); const saved = useExploration(s => s.saved);
  useEffect(() => { if (panel) dialog.current?.showModal(); else dialog.current?.close(); }, [panel]);
  return <dialog aria-labelledby="library-heading" ref={dialog} className="library-dialog" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}><div className="dialog-top"><div className="eyebrow">YOUR SPACE</div><button aria-label="Close panel" onClick={onClose}><X size={18}/></button></div><h2 id="library-heading">The places you’ve been.</h2><p className="dialog-description">Every turn is part of your story. Return to any song in this 40-song catalog.</p>
  {panel === 'history' && <><div className="section-label"><History size={13}/>CURRENT EXPLORATION<span>{session ? session.nodes.filter(n => n.expanded).length : 0} explored</span></div>{session ? <><div className="history-path">{activePath(session).map(n => n.track.title).join(' → ')}</div><div className="track-list">{session.nodes.filter(n => n.expanded || n.nodeId === session.activeNodeId).map(n => <button key={n.nodeId} onClick={() => { void useExploration.getState().expand(n.nodeId); onClose(); }}><Artwork track={n.track}/><span><strong>{n.track.title}</strong><small>{n.track.artists[0].name} · {n.depth === 0 ? 'Starting point' : `Step ${n.depth + 1}`}</small></span>{n.nodeId === session.activeNodeId ? <span className="live-dot"/> : <ArrowUpRight size={15}/>}</button>)}</div></> : <p className="empty-copy">Your first discovery is waiting. Choose a starting song to begin.</p>}<div className="section-label"><Bookmark size={13}/>SAVED SONGS<span>{saved.length}</span></div><div className="track-list">{saved.map(id => session?.nodes.find(n => n.track.id === id)?.track || fmaById.get(id)).filter(t => !!t).map(track => <button key={track.id} onClick={() => { const n = session?.nodes.find(n => n.track.id === track.id); if (n) void useExploration.getState().expand(n.nodeId); else void useExploration.getState().start(track); onClose(); }}><Artwork track={track}/><span><strong>{track.title}</strong><small>{track.artists[0].name}</small></span><ArrowUpRight size={15}/></button>)}</div>{!saved.length && <p className="empty-copy">Save a song with + to keep it here, across explorations.</p>}<p className="demo-explanation">Your current map and saved songs stay in this browser. A new exploration replaces the current map. Mock music-service connections are not part of this demo.</p></>}
  </dialog>;
}
