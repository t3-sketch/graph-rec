'use client';
import { useEffect, useRef, useState } from 'react';
import { AudioLines, Play, Pause, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { usePlayer } from '@/store/player';
import { useExploration } from '@/store/exploration';
import { Artwork } from './Artwork';
const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2,'0')}`;
export function MiniPlayer() {
  const track = usePlayer(s => s.track); const playing = usePlayer(s => s.playing);
  const audio = useRef<HTMLAudioElement>(null); const [progress,setProgress] = useState(0); const [duration,setDuration] = useState(30); const [muted,setMuted] = useState(false); const [error,setError] = useState('');
  const previous = useRef<string | null>(null); const wasPlaying = useRef(false); const completed = useRef(false);
  useEffect(() => {
    const a = audio.current;
    if (!a || !track) { previous.current = null; wasPlaying.current = false; completed.current = false; return; }
    let cancelled = false;
    if (previous.current !== track.id) {
      if (previous.current && wasPlaying.current) useExploration.getState().emit('skip', previous.current);
      previous.current = track.id; completed.current = false; setProgress(0); setError('');
      setDuration(track.durationMs ? track.durationMs / 1000 : 30);
      a.load();
    }
    if (playing) {
      setError('');
      if (completed.current) { a.currentTime = 0; completed.current = false; useExploration.getState().emit('replay',track.id); }
      void a.play().catch(() => { if (!cancelled) { setError('Playback could not start. Try again.'); usePlayer.getState().pause(); } });
    } else a.pause();
    return () => { cancelled = true; };
  }, [track,playing]);

  if (!track) return <div className="bottom-note"><AudioLines size={16}/><span>FMA excerpts, used as provided.</span><span className="demo-label">40-SONG DEMO</span></div>;
  return <div className="mini-player"><audio ref={audio} src={track.previewUrl} preload="metadata" muted={muted} onLoadedMetadata={() => { if (audio.current && Number.isFinite(audio.current.duration)) setDuration(audio.current.duration); }} onTimeUpdate={() => setProgress(audio.current?.currentTime || 0)} onPlay={() => { wasPlaying.current = true; useExploration.getState().emit('preview_start',track.id); }} onPause={() => { if (!completed.current && wasPlaying.current) useExploration.getState().emit('preview_pause',track.id); wasPlaying.current = false; }} onEnded={() => { completed.current = true; wasPlaying.current = false; usePlayer.getState().pause(); useExploration.getState().emit('preview_complete',track.id); }} onError={() => { setError('Preview unavailable. The file may be missing or could not be decoded.'); usePlayer.getState().pause(); }}/>
    <div className="playing-track"><Artwork track={track}/><span><strong>{track.title}</strong><small>{error || `${track.artists[0].name} · FMA excerpt`}</small></span></div>
    <div className="playback-controls"><button aria-label="Replay preview" onClick={() => { if (audio.current) { audio.current.currentTime = 0; completed.current = false; useExploration.getState().emit('replay',track.id); usePlayer.getState().resume(); } }}><RotateCcw size={15}/></button><button className="play-button" aria-label={playing ? 'Pause preview' : 'Play preview'} onClick={() => playing ? usePlayer.getState().pause() : usePlayer.getState().resume()}>{playing ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}</button><span>{time(progress)}</span><input type="range" min={0} max={duration} step={.05} value={progress} aria-label="Preview progress" onChange={e => { if (audio.current) { audio.current.currentTime = +e.target.value; setProgress(+e.target.value); } }}/><span>{time(duration)}</span></div>
    <div className="player-end"><span className="demo-label">FMA EXCERPT</span><button aria-label={muted ? 'Unmute preview' : 'Mute preview'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button><button aria-label="Close player" onClick={() => { useExploration.getState().emit('skip',track.id); usePlayer.setState({track:null,playing:false}); }}><X size={15}/></button></div>
  </div>;
}
