import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/common/error-boundary';

export const metadata: Metadata = {
  title: 'MPS Offline Mission Planner',
  description: 'Offline MAVLink mission planning and export tool.',
  keywords: ['mission planning', 'MAVLink', 'offline planner', 'waypoints'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
