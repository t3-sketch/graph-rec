import type { CSSProperties } from 'react';
import type { Track } from '@/domain/types';
import { artIndex } from '@/mocks/tracks';
export function Artwork({ track, className = '' }: { track: Track; className?: string }) {
  const i = artIndex(track);
  const isMock = track.artworkUrl?.startsWith('/artwork.svg');
  return <div role="img" aria-label={`${track.title} artwork`} className={`artwork art-${i} ${className}`} style={{ '--art-x': `${(i % 3) * 50}%`, '--art-y': `${Math.floor(i / 3) * 50}%`, ...(track.artworkUrl && !isMock ? { backgroundImage: `url("${track.artworkUrl.replace(/["\\]/g, '')}")`, backgroundSize: 'cover' } : {}) } as CSSProperties}><span /></div>;
}
