export async function onRequestGet({ env }) {
  if (!env.LEADS) return Response.json({ ready: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return env.LEADS.fetch('https://internal/config');
}
