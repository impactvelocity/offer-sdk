export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { migrate } = await import("./db/migrate");
  await migrate();
}
