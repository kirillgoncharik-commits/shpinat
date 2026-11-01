import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handle, validate, notification, cleanURL } from '../worker/handler.js';
function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_leads.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0002_delivery_attempt.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) { return { bind(...args) { const statement = db.prepare(sql); return { async first() { return statement.get(...args) || null; }, async run() { return statement.run(...args); } }; } }; } };
  return { db, env: { DB, TURNSTILE_SECRET_KEY: 'unit-test-secret', TURNSTILE_SITE_KEY: 'unit-test-key', CONTACT_EMAIL: 'call@shpinat.club', EMAIL_FROM: 'call@shpinat.club', MAILER: {} } };
}
const payload = (kind = 'application') => ({ kind, request_id: crypto.randomUUID(), turnstile_token: 'unit-token', page_url: `https://shpinat.club/${kind === 'application' ? 'apply' : 'contact'}/?email=private@example.org`, attribution: { landing_page: 'https://shpinat.club/?utm_source=qa&utm_medium=test&utm_campaign=funnel&email=private@example.org', referrer: 'https://example.org/private?secret=1', utm_source: 'qa', utm_medium: 'test', utm_campaign: 'funnel', utm_content: 'hero', cta_location: 'hero' }, fields: { name: 'Тест', email: 'qa@example.org', contact: '@test', location: 'UTC+1', occupation: 'Проверка', stage: 'idea', problem: 'Проверка задачи', result: 'Проверка результата', tried: '', commitment: 'yes', heard_from: 'QA', consent: true, website: '', topic: 'format', message: 'Тестовый вопрос' } });
const request = (p, options = {}) => new Request('https://shpinat.club/api/lead', { method: 'POST', headers: { Origin: 'https://shpinat.club', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...options.headers }, body: JSON.stringify(p) });
const verify = (changes = {}) => async () => Response.json({ success: true, hostname: 'shpinat.club', action: 'application', ...changes });
test('valid application preserves first attribution while stripping unrelated URL parameters', () => {
  const lead = validate(payload());
  assert.equal(lead.attribution.utm_source, 'qa');
  assert.equal(lead.attribution.referrer, 'https://example.org');
  assert.equal(lead.attribution.landing_page, 'https://shpinat.club/?utm_source=qa&utm_medium=test&utm_campaign=funnel');
  assert.equal(lead.page_url, 'https://shpinat.club/apply/');
  assert.equal(lead.consent_version, '2026-11-01');
});
test('application requires all required fields, honest stage and consent', () => {
  for (const key of ['name','email','contact','location','occupation','problem','result','heard_from','commitment','stage']) {
    const p = payload(); p.fields[key] = ''; assert.throws(() => validate(p), undefined, key);
  }
  const p = payload(); p.fields.consent = 'true'; assert.throws(() => validate(p));
  p.fields.consent = true; p.fields.stage = 'invalid'; assert.throws(() => validate(p));
});
test('question accepts either email or a different contact and requires a message', () => {
  const p = payload('contact'); p.fields.name = ''; p.fields.email = ''; assert.equal(validate(p).fields.contact, '@test');
  p.fields.contact = ''; assert.throws(() => validate(p));
  p.fields.email = 'qa@example.org'; assert.equal(validate(p).fields.email, 'qa@example.org');
  p.fields.message = ''; assert.throws(() => validate(p));
});
test('honeypot, oversized fields, email header injection and untrusted page URLs are rejected', () => {
  for (const modify of [p => p.fields.website = 'spam', p => p.fields.message = 'x'.repeat(2501), p => p.fields.email = 'qa@example.org\nBcc: other@example.org', p => p.page_url = 'https://attacker.example/']) {
    const p = payload(); modify(p); assert.throws(() => validate(p));
  }
  assert.equal(cleanURL('javascript:alert(1)'), '');
});
test('unconfigured backend and unsupported methods fail closed', async () => {
  assert.equal((await handle(request(payload()), {}, () => {})).status, 503);
  assert.equal((await handle(new Request('https://shpinat.club/api/lead'), {}, () => {})).status, 405);
});
test('cross-origin submission is rejected before calling Turnstile or mail', async () => {
  const { env } = setup(); let calls = 0;
  const r = await handle(request(payload(), { headers: { Origin: 'https://attacker.example' } }), env, () => calls++, () => calls++);
  assert.equal(r.status, 403); assert.equal(calls, 0);
});
test('missing, rejected, wrong-host and wrong-action Turnstile tokens never persist or send', async () => {
  for (const change of [{ success: false }, { hostname: 'attacker.example' }, { action: 'contact' }]) {
    const { env, db } = setup(); let sent = 0;
    const r = await handle(request(payload()), env, () => sent++, verify(change));
    assert.equal(r.status, 403); assert.equal(sent, 0); assert.equal(db.prepare('SELECT count(*) AS n FROM leads').get().n, 0);
  }
  const { env } = setup(); const p = payload(); p.turnstile_token = ''; assert.equal((await handle(request(p), env, () => {}, verify())).status, 403);
});
test('success is returned only after persistence and email; repeated id does not send twice', async () => {
  const { env, db } = setup(); let sent = 0; const p = payload();
  const send = async message => { sent++; assert.match(message.text, /utm_source: qa/); assert.match(message.text, /Страница: https:\/\/shpinat.club\/apply\//); assert.equal(message.replyTo, 'qa@example.org'); };
  const result = await handle(request(p), env, send, verify());
  assert.equal(result.status, 200); assert.equal((await result.json()).receipt, p.request_id);
  const row = db.prepare('SELECT * FROM leads').get(); assert.equal(row.notification_status, 'sent'); assert.equal(row.status, 'new'); assert.equal(row.cta_location, 'hero'); assert.equal(row.source, 'qa');
  assert.equal((await handle(request(p), env, send, verify())).status, 200); assert.equal(sent, 1);
});
test('delivery failure is not reported as success; retry reuses the persisted lead', async () => {
  const { env, db } = setup(); const p = payload();
  assert.equal((await handle(request(p), env, async () => { throw Error('mailer failed'); }, verify())).status, 502);
  assert.equal(db.prepare('SELECT notification_status FROM leads').get().notification_status, 'failed');
  assert.equal((await handle(request(p), env, async () => {}, verify())).status, 200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM leads').get().n, 1);
});
test('contact email delivery includes topic, message, timestamp and alternate contact without fabricated Reply-To', async () => {
  const { env } = setup(); const p = payload('contact'); p.fields.email = '';
  const r = await handle(request(p), env, async message => { assert.equal(message.replyTo, ''); assert.match(message.text, /Вопрос по формату/); assert.match(message.text, /Тестовый вопрос/); assert.match(message.text, /Время UTC:/); assert.match(message.text, /Другой контакт: @test/); }, verify({ action: 'contact' }));
  assert.equal(r.status, 200);
});
test('daily abuse limit is enforced', async () => {
  const { env } = setup();
  for (let i=0;i<15;i++) assert.equal((await handle(request(payload()), env, async () => {}, verify())).status, 200);
  assert.equal((await handle(request(payload()), env, async () => {}, verify())).status, 429);
});
test('a crashed delivery attempt can be reclaimed after two minutes', async () => {
  const { env, db } = setup(); const p = payload();
  await handle(request(p), env, async () => { throw Error('simulated failure'); }, verify());
  db.prepare("UPDATE leads SET notification_status='sending',notification_attempted_at=? WHERE id=?").run(new Date(Date.now()-180000).toISOString(), p.request_id);
  let sent = 0;
  assert.equal((await handle(request(p), env, async () => sent++, verify())).status, 200);
  assert.equal(sent, 1);
  assert.equal(db.prepare('SELECT notification_status FROM leads').get().notification_status, 'sent');
});
