import { ArrowUpRight, Heart, Plus, Check, Play, Pause, X } from 'lucide-react';
import type { Track } from '@/domain/types';
import { Artwork } from './Artwork';
import { useExploration } from '@/store/exploration';
import { usePlayer } from '@/store/player';
export function TrackInspector({ track, onClose }: { track: Track; onClose(): void }) {
  const liked = useExploration(s => s.liked.includes(track.id)); const saved = useExploration(s => s.saved.includes(track.id));
  const toggle = useExploration(s => s.toggle);
  const isPlaying = usePlayer(s => s.track?.id === track.id && s.playing);
  const duration = Math.round((track.durationMs || 0) / 1000);
  function preview() { if (isPlaying) usePlayer.getState().pause(); else usePlayer.getState().play(track); }
  return <aside className="inspector" aria-label="Selected song"><div className="eyebrow">IN YOUR ORBIT<button aria-label="Close song inspector" onClick={onClose}><X size={13}/></button></div><Artwork track={track}/><h2>{track.title}</h2><p>{track.artists.map(a => a.name).join(', ')}</p><small>{track.genreNames?.join(' · ')} <span>· {Math.floor(duration / 60)}:{String(duration % 60).padStart(2,'0')} excerpt</span></small>
    <div className="track-actions"><button className="primary-button" onClick={preview} disabled={!track.previewUrl}>{isPlaying ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}{isPlaying ? 'Pause' : track.previewUrl ? 'Preview' : 'No preview'}</button><button className={`icon-action ${liked ? 'is-on' : ''}`} aria-label={liked ? 'Unlike song' : 'Like song'} aria-pressed={liked} onClick={() => toggle('liked',track.id)}><Heart size={17} fill={liked ? 'currentColor' : 'none'}/></button><button className={`icon-action ${saved ? 'is-on' : ''}`} aria-label={saved ? 'Unsave song' : 'Save song'} aria-pressed={saved} onClick={() => toggle('saved',track.id)}>{saved ? <Check size={17}/> : <Plus size={18}/>}</button></div>
    <div className="inspector-rule"/>
    <div className="external-links">
      {track.sourceUrl && <a href={track.sourceUrl} target="_blank" rel="noopener noreferrer">Source on FMA<ArrowUpRight size={13}/></a>}
      {track.licenseUrl && <a href={track.licenseUrl} target="_blank" rel="noopener noreferrer">CC BY license<ArrowUpRight size={13}/></a>}
    </div>
    <div className="inspector-caption">FMA excerpt. The app does not alter the audio.<br/>Like and Save are explicit reactions, not ranking labels.</div>
  </aside>;
}
