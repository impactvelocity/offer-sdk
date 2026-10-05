// Same format as the legacy `stripe-nanoid` ids, e.g. `app_AbCdEf`, `key_…`, `pub_…`.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTWXYZabcdefghijklmnopqrstwxyz";

export function prefixedId(prefix: string, size: number): string {
  let out = "";
  while (out.length < size) {
    const bytes = crypto.getRandomValues(new Uint8Array(size * 2));
    for (const b of bytes) {
      const i = b & 63; // rejection sampling keeps the distribution uniform
      if (i < ALPHABET.length) out += ALPHABET[i];
      if (out.length === size) break;
    }
  }
  return `${prefix}_${out}`;
}
