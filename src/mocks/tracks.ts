import type { Track } from '@/domain/types';
const names = ['Neon Horizon','Glass Cities','Afterimage','Cloud Memory','Midnight Signal','Slow Motion','Weightless','A Place Between','Satellite Heart','Distant Bloom','Soft Focus','Open Water','Blue Hours','Peripheral','Last Light','Foreign Air','Sunroom','Still Life','Tidal','Velvet Skies','Half Asleep','Daybreak','Parallel Lines','Falling Into Place','Night Swimming','Golden','Echo Chamber','Northern Lights','Small Hours','Wildflower','In Transit','Somewhere Else'];
const artists = ['Aster','Luma','Kairo','Serein','NOVA','Low Season','Elska','Mira Sol','Faint Waves','Juniper','Onda','Solace','Akiro','Nilo','Isola','Hollow Coast'];
export const tracks: Track[] = Array.from({ length: 640 }, (_, i) => ({
  id: `sonder-${i + 1}`,
  title: names[i % names.length] + (i >= names.length ? ` · ${['Reverie','Nightfall','Drift','Tapes','Sessions'][Math.floor(i / names.length) % 5]} ${Math.floor(i / names.length)}` : ''),
  artists: [{ name: artists[i % artists.length] }],
  album: { name: ['Between Worlds','Forms of Silence','A Different Kind of Blue','Soft Landing','Signals from Home','Almost Familiar','Room to Breathe','The In-between'][i % 8] },
  durationMs: (183 + (i * 17) % 150) * 1000,
  artworkUrl: `/artwork.svg#${i % 9}`,
  previewUrl: i % 4 !== 3 ? `/audio/preview-${i % 3}.wav` : undefined,
}));
export function searchTracks(query: string) {
  const q = query.trim().toLocaleLowerCase();
  return tracks.filter(t => !q || `${t.title} ${t.artists.map(a => a.name).join(' ')} ${t.album?.name}`.toLocaleLowerCase().includes(q)).slice(0, 8);
}
export function artIndex(track: Track) { return Math.max(0, Number(track.id.split('-').at(-1)) - 1) % 9; }
