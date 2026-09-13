import { create } from 'zustand';
import type { Track } from '@/domain/types';
export const usePlayer = create<{ track: Track | null; playing: boolean; play(track: Track): void; pause(): void; resume(): void }>(set => ({
  track: null, playing: false,
  play(track) { if (track.previewUrl) set({ track, playing: true }); },
  pause() { set({ playing: false }); }, resume() { set({ playing: true }); },
}));
