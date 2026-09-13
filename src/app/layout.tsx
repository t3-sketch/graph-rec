import type { Metadata } from 'next';
import '@xyflow/react/dist/style.css';
import './globals.css';
export const metadata: Metadata = { title: 'Sonder — music, in every direction', description: 'Follow your curiosity. A song-by-song journey through your own music universe.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
