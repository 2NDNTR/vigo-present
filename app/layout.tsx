import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vigo Presents',
  description: 'On-brand presentations for Vigo Importing Company, Vigo Foods and Alessi Foods.',
};

const FONTS =
  'https://fonts.googleapis.com/css2' +
  '?family=Inter:wght@400;500;600;700' +
  '&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600' +
  '&family=Archivo:wght@400;500;600;700' +
  '&family=Cormorant+Garamond:wght@400;500;600' +
  '&display=swap';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
