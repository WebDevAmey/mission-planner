const pad = (n: number) => String(n).padStart(2, '0');

/**
 * `"My Mission!"` -> `my-mission_20260115-093000.plan`. Characters outside [a-z0-9-_]
 * become `-`, the slug is at most 80 characters, and a UTC timestamp is appended.
 */
export function slugFilename(name: string, ext: string, now: Date = new Date()): string {
  const slug =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_]+|[-_]+$/g, '')
      .slice(0, 80)
      .replace(/[-_]+$/g, '') || 'mission';
  const ts =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `${slug}_${ts}.${ext.replace(/^\./, '')}`;
}
