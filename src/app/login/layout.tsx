import type { ReactNode } from 'react';
import { SignedOutOnly } from '@/lib/auth/signed-out-only';

export default function Layout({ children }: { children: ReactNode }) {
  return <SignedOutOnly>{children}</SignedOutOnly>;
}
