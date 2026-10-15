import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings · Flight Deck',
  description: 'Manage your Flight Deck profile, password, sessions and account.',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
