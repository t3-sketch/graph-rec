'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, ArrowUpRight, X } from 'lucide-react';
import { searchTracks } from '@/mocks/tracks';
import { useExploration } from '@/store/exploration';
import { Artwork } from './Artwork';
export function MusicSearch() {
  const [query, setQuery] = useState(''); const [open, setOpen] = useState(false); const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null); const input = useRef<HTMLInputElement>(null);
  const results = searchTracks(query); const start = useExploration(s => s.start);
  useEffect(() => { const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as globalThis.Node)) setOpen(false); }; const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); input.current?.focus(); } }; document.addEventListener('pointerdown', close); document.addEventListener('keydown', key); return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); }; }, []);
  function choose(i: number) { if (results[i]) { void start(results[i]); setOpen(false); setQuery(''); input.current?.blur(); } }
  return <div className="search-wrap" ref={ref}><Search size={18}/><input ref={input} role="combobox" aria-label="Search songs, artists, albums" aria-controls="search-results" aria-expanded={open} aria-autocomplete="list" aria-activedescendant={open && results[index] ? `result-${index}` : undefined} placeholder="Search songs, artists, albums…" value={query} onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setIndex(0); setOpen(true); }} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setIndex(i => Math.min(i + 1, results.length - 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(0, i - 1)); } if (e.key === 'Enter' && open) { e.preventDefault(); choose(index); } }} />{query ? <button aria-label="Clear search" onClick={() => setQuery('')}><X size={14}/></button> : <kbd>⌘ K</kbd>}
    {open && <div className="search-results" id="search-results" role="listbox" aria-label="Songs"><div className="eyebrow">{query ? 'SONGS' : 'A GOOD PLACE TO START'}<span>DEMO CATALOG</span></div>{results.map((track, i) => <button id={`result-${i}`} key={track.id} role="option" aria-selected={index === i} className={index === i ? 'highlighted' : ''} onClick={() => choose(i)}><Artwork track={track}/><span><strong>{track.title}</strong><small>{track.artists[0].name} · {track.album?.name}</small></span><ArrowUpRight size={16}/></button>)}{!results.length && <p className="empty-copy">No songs found. Try “Neon”, “Luma”, or “Blue”.</p>}<div className="search-foot">↑ ↓ to browse <span>↵ to start a new map</span></div></div>}
  </div>;
}
