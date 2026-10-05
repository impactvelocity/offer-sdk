/** better-auth client calls resolve to `{ data, error }`; turn that into a throwing promise for react-query. */
export async function unwrap<T>(call: Promise<{ data: T | null; error: { message?: string; statusText?: string } | null }>) {
  const { data, error } = await call;
  if (error) throw new Error(error.message || error.statusText || "Something went wrong");
  return data as T;
}
