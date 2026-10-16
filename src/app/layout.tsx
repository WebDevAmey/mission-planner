import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { ErrorBoundary } from '@/components/common/error-boundary';

export const metadata: Metadata = {
  title: {
    default: 'Flight Deck — ArduPilot mission planner',
    template: '%s · Flight Deck',
  },
  description:
    'Go from an area on a map to a validated, ground-station-ready mission file. Survey grids, route optimisation, no-fly zones, terrain checks and exports for Mission Planner and QGroundControl.',
  applicationName: 'Flight Deck',
  keywords: ['mission planning', 'ArduPilot', 'MAVLink', 'drone survey', 'waypoints', 'QGroundControl'],
};

// Pinch-zoom stays enabled (WCAG 1.4.4): no maximumScale / userScalable lock.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f4f0' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0b0d' },
  ],
};

// Light-first (DESIGN_SPEC D-12), dark is a full peer. Apply an explicit dark
// choice made with BoardUI's ThemeToggle before first paint so there is no flash.
const themeScript =
  '(function(){try{if(localStorage.getItem("boardui:theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}})();';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
