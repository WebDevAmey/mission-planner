/**
 * Stand-in for `next/headers` so route handlers can be called directly in
 * tests. Tests set the current cookie jar / request headers through `jar`.
 */
type Cookie = { name: string; value: string };

export const jar = {
  cookies: new Map<string, string>(),
  headers: new Headers(),
  reset() {
    this.cookies.clear();
    this.headers = new Headers();
  },
};

export async function cookies() {
  return {
    get(name: string): Cookie | undefined {
      const value = jar.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string) {
      jar.cookies.set(name, value);
    },
    delete(name: string) {
      jar.cookies.delete(name);
    },
  };
}

export async function headers() {
  return jar.headers;
}
