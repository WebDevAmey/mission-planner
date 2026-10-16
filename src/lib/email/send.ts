/**
 * Transactional email via the Resend REST API, called directly with `fetch` —
 * no SDK dependency. Pluggable: without `RESEND_API_KEY` configured, delivery
 * is honestly reported as failed rather than faked. Route handlers that need
 * to stay testable without real email (signup verification, password reset)
 * surface a `devLink` back to the caller, but only outside production — see
 * each call site's `NODE_ENV` guard.
 */

/** `jane.doe@example.com` → `j***@e***.com`, for logs (S11: no raw addresses in logs). */
export function redactEmail(address: string): string {
  const [local = '', domain = ''] = address.split('@');
  const dot = domain.lastIndexOf('.');
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}***${tld}`;
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ delivered: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Flight Deck <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY is not set — no email was sent. Would have sent "${input.subject}" to ${redactEmail(input.to)}.`
    );
    return { delivered: false };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      // Sign-up and password reset wait on this call; never hang them on the provider.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[email] Resend API returned an error', res.status, body.replaceAll(input.to, redactEmail(input.to)));
      return { delivered: false };
    }

    return { delivered: true };
  } catch (err) {
    console.error('[email] Failed to reach Resend', err instanceof Error ? err.message : 'unknown error');
    return { delivered: false };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<{ delivered: boolean }> {
  return sendEmail({
    to,
    subject: 'Verify your Flight Deck account',
    html: `<p>Confirm your email address to finish setting up your Flight Deck account.</p>
<p><a href="${escapeHtml(verifyUrl)}">Verify email address</a></p>
<p>This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>`,
    text: `Confirm your email address to finish setting up your Flight Deck account:\n${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this email.`,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<{ delivered: boolean }> {
  return sendEmail({
    to,
    subject: 'Reset your Flight Deck password',
    html: `<p>We received a request to reset the password for this account.</p>
<p><a href="${escapeHtml(resetUrl)}">Reset password</a></p>
<p>This link expires in 1 hour. If you didn't request this, you can ignore this email — your password will not change.</p>`,
    text: `We received a request to reset the password for this account:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email — your password will not change.`,
  });
}
