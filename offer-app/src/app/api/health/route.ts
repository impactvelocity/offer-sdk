export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
}
