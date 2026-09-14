import type { Track } from '@/domain/types';
import records from './fma40-catalog.json';

export const FMA40_DATASET_ID = 'sonder-fma-40-v1';
export const FMA40_PROVIDER_ID = 'genre-jaccard-v1';
export const START_TRACK_IDS = ['fma-015769', 'fma-023371', 'fma-075782'] as const;

export type FmaCatalogRecord = {
  id: string;
  title: string;
  artists: { name: string }[];
  genre_ids: number[];
  genre_names: string[];
  source_url: string;
  license_url: string;
  audio_sha256: string;
  preview_duration_ms: number;
};

export const fmaCatalog: FmaCatalogRecord[] = records as FmaCatalogRecord[];

export function fmaNumericId(id: string): number {
  return Number(id.slice(4));
}

export function audioPath(id: string): string {
  return `/audio/fma/${id.slice(4)}.mp3`;
}

export function toTrack(record: FmaCatalogRecord): Track {
  return {
    id: record.id,
    title: record.title,
    artists: record.artists.map(artist => ({ name: artist.name })),
    durationMs: record.preview_duration_ms,
    previewUrl: audioPath(record.id),
    genreIds: record.genre_ids,
    genreNames: record.genre_names,
    sourceUrl: record.source_url,
    licenseUrl: record.license_url,
    audioSha256: record.audio_sha256,
  };
}

export const fmaTracks: Track[] = fmaCatalog.map(toTrack);
export const fmaById = new Map(fmaTracks.map(track => [track.id, track]));
export const fmaRecordById = new Map(fmaCatalog.map(record => [record.id, record]));
export const startTracks = START_TRACK_IDS.map(id => {
  const track = fmaById.get(id);
  if (!track) throw new Error(`missing start track ${id}`);
  return track;
});

export function searchFmaTracks(query: string): Track[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return startTracks;
  return fmaTracks.filter(track => (
    track.title.toLowerCase().includes(needle)
    || track.artists.some(artist => artist.name.toLowerCase().includes(needle))
    || track.genreNames?.some(name => name.toLowerCase().includes(needle))
  )).slice(0, 8);
}
