const HOSTS = new Set(['shpinat.club', 'www.shpinat.club']);
const stages = ['idea', 'starting', 'project', 'business'];
const topics = ['participation', 'format', 'partnership', 'other'];
const emailPattern = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
const campaignPattern = /^[a-zA-Z0-9_.~ -]{1,120}$/;
export const CONSENT_VERSION = '2026-11-01';
const response = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const failure = (message, status = 400) => response({ ok: false, message }, status);
const text = (value, max = 1000) => typeof value === 'string' ? value.replace(/\r/g, '').trim().slice(0, max) : '';
export function cleanURL(value, own = false) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || (own && !HOSTS.has(url.hostname))) return '';
    const clean = new URL(url.origin + url.pathname);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
      const value = url.searchParams.get(key);
      if (campaignPattern.test(value || '')) clean.searchParams.set(key, value);
    }
    return clean.href;
  } catch { return ''; }
}
export function validate(payload) {
  if (!['application', 'contact'].includes(payload?.kind)) throw new Error('Неизвестный тип формы.');
  const input = payload.fields || {};
  if (input.website) throw new Error('Не удалось проверить форму.');
  if (input.consent !== true) throw new Error('Нужно согласие на обработку данных.');
  const fields = {};
  for (const [key, max] of Object.entries({ name: 100, email: 254, contact: 160, location: 160, occupation: 500, stage: 30, problem: 1800, result: 1800, tried: 1800, commitment: 20, heard_from: 300, topic: 30, message: 2500 })) {
    if (typeof input[key] === 'string' && input[key].length > max) throw new Error('Одно из полей слишком длинное. Сократи ответ.');
    fields[key] = text(input[key], max);
  }
  if (fields.email && !emailPattern.test(fields.email)) throw new Error('Проверь email.');
  if (/[\r\n]/.test(fields.email)) throw new Error('Проверь email.');
  if (payload.kind === 'application') {
    for (const key of ['name', 'email', 'contact', 'location', 'occupation', 'problem', 'result', 'heard_from']) if (!fields[key]) throw new Error('Заполни обязательные поля.');
    if (!stages.includes(fields.stage) || !['yes', 'discuss'].includes(fields.commitment)) throw new Error('Выбери стадию и готовность участвовать.');
  } else {
    if (!fields.email && !fields.contact) throw new Error('Укажи email или другой контакт.');
    if (!topics.includes(fields.topic) || !fields.message) throw new Error('Выбери тему и напиши сообщение.');
  }
  if (!/^[a-zA-Z0-9-]{20,60}$/.test(payload.request_id || '')) throw new Error('Обнови страницу и попробуй ещё раз.');
  const page = cleanURL(payload.page_url, true);
  if (!page) throw new Error('Не удалось определить страницу формы.');
  const source = payload.attribution || {};
  const attribution = { offer: 'shpinat', landing_page: cleanURL(source.landing_page, true) || page, referrer: '', page: new URL(page).pathname, cta_location: text(source.cta_location, 80).replace(/[^a-zA-Z0-9_-]/g, '') || 'direct' };
  try { attribution.referrer = new URL(source.referrer).origin; } catch {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) attribution[key] = campaignPattern.test(source[key] || '') ? source[key] : '';
  return { id: payload.request_id, kind: payload.kind, fields, attribution, page_url: page, consent_version: CONSENT_VERSION };
}
export function notification(lead) {
  const labels = { name: 'Имя', email: 'Email', contact: 'Другой контакт', location: 'Город / страна / часовой пояс', occupation: 'Занятие', stage: 'Стадия', problem: 'Главная задача', result: 'Результат за 8 недель', tried: 'Что уже пробовал', commitment: 'Готовность участвовать', heard_from: 'Откуда узнал', topic: 'Тема', message: 'Сообщение' };
  const values = { idea: 'Идея', starting: 'Начинаю проект', project: 'Работающий проект', business: 'Действующий бизнес', yes: 'Готов регулярно участвовать', discuss: 'Хочу обсудить', participation: 'Участие в программе', format: 'Вопрос по формату', partnership: 'Партнёрство', other: 'Другое' };
  const lines = [`ШПИНАТ: ${lead.kind === 'application' ? 'заявка на участие' : 'вопрос'}`, `ID: ${lead.id}`, `Время UTC: ${lead.created_at}`, `Страница: ${lead.page_url}`, ''];
  for (const [key, label] of Object.entries(labels)) if (lead.fields[key]) lines.push(`${label}: ${values[lead.fields[key]] || lead.fields[key]}`, '');
  lines.push('Источник обращения:', ...Object.entries(lead.attribution).map(([key, value]) => `${key}: ${value || '(нет)'}`), '', `Согласие: ${lead.consent_version}`, 'Статус: new');
  return { subject: `ШПИНАТ — ${lead.kind === 'application' ? 'Новая заявка' : 'Новый вопрос'} [${lead.id.slice(0, 8)}]`, text: lines.join('\n'), replyTo: lead.fields.email || '' };
}
export async function handle(request, env, send, fetcher = fetch) {
  const url = new URL(request.url);
  const ready = Boolean(env.DB && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY && env.CONTACT_EMAIL && env.EMAIL_FROM && env.MAILER);
  if (url.pathname === '/config' && request.method === 'GET') return response({ ready, turnstileSiteKey: env.TURNSTILE_SITE_KEY || '', contactEmail: env.CONTACT_EMAIL || '' }, ready ? 200 : 503);
  if (request.method !== 'POST') return failure('Метод не поддерживается.', 405);
  let origin;
  try { origin = new URL(request.headers.get('Origin')).hostname; } catch {}
  if (!HOSTS.has(origin) || !HOSTS.has(url.hostname)) return failure('Недопустимый источник запроса.', 403);
  if (!ready) return failure('Форма временно недоступна. Напиши нам напрямую.', 503);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return failure('Неизвестный формат запроса.', 415);
  if (Number(request.headers.get('Content-Length')) > 18000) return failure('Слишком большой запрос.', 413);
  let payload, lead;
  try { const body = await request.text(); if (body.length > 18000) return failure('Слишком большой запрос.', 413); payload = JSON.parse(body); lead = validate(payload); } catch (error) { return failure(error instanceof SyntaxError ? 'Не удалось прочитать форму.' : error.message); }
  const token = payload.turnstile_token;
  if (typeof token !== 'string' || !token.length || token.length > 2048) return failure('Пройди проверку защиты от спама.', 403);
  try {
    const check = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: request.headers.get('CF-Connecting-IP') || undefined }), signal: AbortSignal.timeout(10000) });
    const verification = await check.json();
    if (!check.ok || !verification.success || !HOSTS.has(verification.hostname) || verification.action !== lead.kind) return failure('Проверка защиты не пройдена. Попробуй отправить ещё раз.', 403);
  } catch { return failure('Проверка защиты временно недоступна. Попробуй ещё раз.', 503); }
  try {
    // A daily salted IP hash limits abuse without retaining the IP itself.
    const day = new Date().toISOString().slice(0, 10);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.TURNSTILE_SECRET_KEY}:${day}:${request.headers.get('CF-Connecting-IP') || 'unknown'}`));
    const rateKey = [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();
    const rate = await env.DB.prepare('INSERT INTO rate_limits (key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(rateKey, now + 86400).first();
    if (rate.hits > 15) return failure('Слишком много обращений. Напиши нам напрямую.', 429);
    const existing = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(lead.id).first();
    if (existing) {
      const previous = JSON.parse(existing.data_json);
      if (previous.fields.email !== lead.fields.email || previous.fields.contact !== lead.fields.contact || previous.kind !== lead.kind) return failure('Обнови страницу перед новой отправкой.', 409);
      if (existing.notification_status === 'sent') return response({ ok: true, receipt: lead.id });
      lead = previous;
    } else {
      lead.created_at = new Date().toISOString();
      await env.DB.prepare('INSERT INTO leads (id,created_at,kind,name,email,contact,topic,source,landing,page,cta_location,data_json,consent_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(lead.id, lead.created_at, lead.kind, lead.fields.name, lead.fields.email, lead.fields.contact, lead.fields.topic, lead.attribution.utm_source || lead.attribution.referrer || 'direct', lead.attribution.landing_page, lead.page_url, lead.attribution.cta_location, JSON.stringify(lead), CONSENT_VERSION).run();
    }
    const claim = await env.DB.prepare("UPDATE leads SET notification_status = 'sending', notification_attempted_at = ? WHERE id = ? AND (notification_status IN ('pending','failed') OR (notification_status = 'sending' AND notification_attempted_at < ?)) RETURNING id").bind(new Date().toISOString(), lead.id, new Date(Date.now() - 120000).toISOString()).first();
    if (!claim) return failure('Обращение обрабатывается. Подожди минуту и попробуй ещё раз.', 409);
    try {
      await send(notification(lead), env);
      await env.DB.prepare("UPDATE leads SET notification_status = 'sent', notification_sent_at = ? WHERE id = ?").bind(new Date().toISOString(), lead.id).run();
    } catch (error) {
      console.error('lead_notification_failed', lead.id, String(error?.message || 'provider error').slice(0, 180));
      await env.DB.prepare("UPDATE leads SET notification_status = 'failed' WHERE id = ?").bind(lead.id).run();
      return failure('Доставка задерживается. Попробуй ещё раз или напиши нам напрямую.', 502);
    }
    return response({ ok: true, receipt: lead.id });
  } catch { return failure('Не получилось отправить обращение. Попробуй ещё раз или напиши нам напрямую.', 503); }
}
