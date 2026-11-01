import { EmailMessage } from 'cloudflare:email';
import { handle } from './handler.js';
function base64(value) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}
async function send(message, env) {
  const recipient = env.LEAD_NOTIFICATION_EMAIL || env.CONTACT_EMAIL;
  for (const value of [env.EMAIL_FROM, recipient, message.replyTo]) if (value && /[\r\n<>]/.test(value)) throw new Error('Invalid email header');
  const headers = [
    `From: ${env.EMAIL_FROM}`, `To: ${recipient}`,
    `Subject: =?UTF-8?B?${base64(message.subject)}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@shpinat.club>`,
    ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '', base64(message.text).match(/.{1,76}/g).join('\r\n')
  ];
  await env.MAILER.send(new EmailMessage(env.EMAIL_FROM, recipient, headers.join('\r\n')));
}
export default { fetch: (request, env) => handle(request, env, send) };
