import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/guard';

/**
 * Layout body for /login and /signup: a signed-in user goes to the dashboard.
 * The proxy already redirects page loads (and honours a safe ?next=); this
 * covers client-side navigations, which the proxy lets through because Next
 * strips their RSC headers and a 307 there would end in a 404.
 */
export async function SignedOutOnly({ children }: { children: ReactNode }) {
  if (await getCurrentUser()) redirect('/dashboard');
  return children;
}
