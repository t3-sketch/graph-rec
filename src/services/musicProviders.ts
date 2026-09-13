import type { Track } from '@/domain/types';
import { tracks } from '@/mocks/tracks';
export type ProviderId = 'spotify' | 'appleMusic';
export type ProviderProfile = { id: string; displayName: string; mode: 'demo' | 'live' };
export type ProviderPlaylist = { id: string; name: string; description: string; tracks: Track[] };
export interface MusicServiceProvider {
  id: ProviderId;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getUserProfile(): Promise<ProviderProfile | null>;
  getPlaylists(): Promise<ProviderPlaylist[]>;
  getLibraryTracks?(): Promise<Track[]>;
}
export class MockMusicProvider implements MusicServiceProvider {
  constructor(public readonly id: ProviderId) {}
  async connect() { localStorage.setItem(`sonder.provider.${this.id}`, 'demo'); }
  async disconnect() { localStorage.removeItem(`sonder.provider.${this.id}`); }
  async getUserProfile(): Promise<ProviderProfile | null> { return localStorage.getItem(`sonder.provider.${this.id}`) === 'demo' ? { id: `demo-${this.id}`, displayName: 'Your demo library', mode: 'demo' } : null; }
  async getPlaylists(): Promise<ProviderPlaylist[]> {
    if (!await this.getUserProfile()) return [];
    return [
      { id: 'late-night', name: 'After hours', description: 'For when the rest of the world is asleep.', tracks: tracks.slice(0, 12) },
      { id: 'soft-focus', name: 'Soft focus', description: 'A little space to get lost in.', tracks: tracks.slice(12, 24) },
      { id: 'new-horizons', name: 'New horizons', description: 'Somewhere you have not been before.', tracks: tracks.slice(24, 36) },
    ];
  }
  async getLibraryTracks() { return await this.getUserProfile() ? tracks.slice(0, 24) : []; }
}
// Replace each independently: Spotify OAuth/PKCE and Apple MusicKit authorization have different mechanics.
export const musicProviders: Record<ProviderId, MusicServiceProvider> = {
  spotify: new MockMusicProvider('spotify'), appleMusic: new MockMusicProvider('appleMusic'),
};
export function externalTrackUrl(track: Track, provider: ProviderId) {
  const query = encodeURIComponent(`${track.title} ${track.artists.map(a => a.name).join(' ')}`);
  const id = track.externalIds?.[provider];
  return provider === 'spotify' ? id ? `https://open.spotify.com/track/${encodeURIComponent(id)}` : `https://open.spotify.com/search/${query}` : id ? `https://music.apple.com/song/${encodeURIComponent(id)}` : `https://music.apple.com/us/search?term=${query}`;
}
