// Only the private service can persist a lead or send its notification.
export async function onRequest(context) {
  if (!context.env.LEADS) return Response.json({ ok: false, message: 'Форма временно недоступна. Напиши нам напрямую.' }, { status: 503 });
  return context.env.LEADS.fetch(context.request);
}
