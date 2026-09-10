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
  // Corporate: Jost sets every heading, Playfair Display carries the numerals
  // and pull quotes. Both are lifted from the Capabilities 2026 site.
  '&family=Jost:wght@400;500;600;700;800' +
  '&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600' +
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
