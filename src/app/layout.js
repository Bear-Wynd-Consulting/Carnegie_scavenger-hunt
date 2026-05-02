import './globals.css';

export const metadata = {
  title: 'Carnegie Libraries — Ontario Scavenger Hunt',
  description: 'Explore and photograph all 94 Carnegie Libraries across Ontario. Track your visits, get directions, and compete on the leaderboard.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Carnegie Libraries — Ontario Scavenger Hunt',
    description: 'Can you visit all 94 Carnegie Libraries in Ontario?',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a1a2e',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  );
}
