import { hash, verify } from '@node-rs/argon2';

// OWASP-recommended baseline: 19 MiB memory, 2 iterations, 1 lane. Algorithm
// is intentionally left unset — Argon2id is the library's own default, and
// its `Algorithm` enum is a TypeScript const enum, which `isolatedModules`
// (required by Next.js's per-file compilation) can't reference by name.
const HASH_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return verify(passwordHash, password, HASH_OPTIONS);
}
