// Same format as the hosted API's ids, e.g. `app_AbCdEf`, `key_…`, `pub_…`.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTWXYZabcdefghijklmnopqrstwxyz";

export function prefixedId(prefix: string, size: number): string {
  let out = "";
  while (out.length < size) {
    for (const b of crypto.getRandomValues(new Uint8Array(size * 2))) {
      const i = b & 63; // rejection sampling keeps the distribution uniform
      if (i < ALPHABET.length) out += ALPHABET[i];
      if (out.length === size) break;
    }
  }
  return `${prefix}_${out}`;
}
