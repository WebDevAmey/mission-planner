import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ErrorBoundary } from '@/components/common/error-boundary';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

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
  colorScheme: 'dark',
  themeColor: '#0a0a0a',
};

// Dark-first. Honour an explicit light choice made with BoardUI's ThemeToggle
// before first paint so there is no flash.
const themeScript =
  '(function(){try{if(localStorage.getItem("boardui:theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}})();';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
