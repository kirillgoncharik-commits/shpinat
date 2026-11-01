'use strict';
(() => {
  const attributionKey = 'shpinat.attribution.v1';
  const entryKey = 'shpinat.cta.v1';
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  const campaign = value => /^[a-zA-Z0-9_.~ -]{1,120}$/.test(value || '') ? value : '';
  const safeURL = value => {
    try {
      const url = new URL(value, location.origin);
      const clean = new URL(url.origin + url.pathname);
      utmKeys.forEach(key => { const v = campaign(url.searchParams.get(key)); if (v) clean.searchParams.set(key, v); });
      return clean.href;
    } catch (_) { return ''; }
  };
  const read = key => { try { return JSON.parse(sessionStorage.getItem(key)); } catch (_) { return null; } };
  const save = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const params = new URLSearchParams(location.search);
  let attribution = read(attributionKey);
  if (!attribution) {
    let referrer = '';
    try { referrer = document.referrer ? new URL(document.referrer).origin : ''; } catch (_) {}
    attribution = { landing_page: safeURL(location.href), referrer, ...Object.fromEntries(utmKeys.map(key => [key, campaign(params.get(key))])) };
    save(attributionKey, attribution);
  }
  const entry = () => read(entryKey)?.location || 'direct';
  const properties = placement => ({ ...attribution, page: location.pathname, cta_location: placement || entry(), offer: 'shpinat' });
  const track = (name, placement) => document.dispatchEvent(new CustomEvent('shpinat:event', { detail: { name, properties: properties(placement) } }));
  window.SHPINAT_FUNNEL = Object.freeze({ properties, track, safeURL });

  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    const placement = link.dataset.ctaLocation || link.dataset.booking || 'content';
    if (link.hasAttribute('data-primary-cta')) {
      save(entryKey, { location: placement });
      track('primary_cta_click', placement);
    }
    if (link.hasAttribute('data-contact-cta')) save(entryKey, { location: placement });
    if (link.href.startsWith('mailto:')) track('email_click', placement);
    if (link.hostname === 'calendly.com') track('calendly_click', placement);
  });

  document.querySelectorAll('[data-contact-email]').forEach(link => {
    const email = window.SHPINAT_CONFIG?.contactEmail;
    if (!email) return;
    link.href = 'mailto:' + email;
    link.textContent = email;
    link.closest('[data-contact-email-block]').hidden = false;
  });

  const forms = [...document.querySelectorAll('[data-lead-form]')];
  if (!forms.length) return;
  let widgetAPI;
  let configuration;
  const loadTurnstile = () => widgetAPI || (widgetAPI = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    window.shpinatTurnstileReady = () => resolve(window.turnstile);
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=shpinatTurnstileReady&render=explicit';
    script.async = true;
    script.onerror = () => reject(new Error('Не удалось загрузить защиту от спама. Обнови страницу или напиши нам напрямую.'));
    document.head.appendChild(script);
  }));
  configuration = fetch('/api/config', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error('Форма временно недоступна. Напиши нам напрямую или выбери время знакомства.');
    return response.json();
  });

  forms.forEach(form => {
    const kind = form.dataset.leadForm;
    const notice = form.querySelector('[data-form-status]');
    const button = form.querySelector('[type=submit]');
    const controls = form.querySelector('fieldset');
    let started = false;
    let widget;
    let turnstile;
    let requestId = crypto.randomUUID();
    form.addEventListener('focusin', event => {
      if (!started && event.target.matches('input,textarea,select') && !event.target.closest('[data-antispam]')) {
        started = true;
        track(kind === 'application' ? 'application_start' : 'contact_form_start');
      }
    });
    configuration.then(async config => {
      if (!config.ready) throw new Error('Форма временно недоступна. Напиши нам напрямую или выбери время знакомства.');
      turnstile = await loadTurnstile();
      widget = turnstile.render(form.querySelector('[data-antispam]'), {
        sitekey: config.turnstileSiteKey,
        action: kind,
        theme: 'light',
        size: 'flexible',
        callback: () => { notice.textContent = ''; },
        'error-callback': () => { notice.textContent = 'Проверка защиты не загрузилась. Попробуй обновить страницу или напиши нам напрямую.'; },
        'expired-callback': () => turnstile.reset(widget)
      });
      controls.disabled = false;
      button.disabled = false;
      notice.textContent = '';
    }).catch(error => { notice.textContent = error.message; });

    const email = form.elements.namedItem('email');
    const contact = form.elements.namedItem('contact');
    const validateContact = () => {
      if (kind === 'contact') email.setCustomValidity(email.value.trim() || contact.value.trim() ? '' : 'Укажи email или другой контакт, чтобы мы могли ответить.');
    };
    [email, contact].forEach(input => input?.addEventListener('input', validateContact));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      validateContact();
      if (!form.reportValidity()) return;
      const token = turnstile?.getResponse(widget);
      if (!token) { notice.textContent = 'Дождись проверки защиты от спама и отправь форму ещё раз.'; return; }
      button.disabled = true;
      notice.textContent = 'Отправляем…';
      const fields = Object.fromEntries(new FormData(form));
      fields.consent = fields.consent === 'on';
      const payload = { kind, fields, attribution: properties(), page_url: safeURL(location.href), request_id: requestId, turnstile_token: token };
      try {
        const response = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(25000) });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || 'Не получилось отправить. Попробуй ещё раз или напиши нам напрямую.');
        track(kind === 'application' ? 'application_submit' : 'contact_form_submit');
        form.hidden = true;
        const success = document.querySelector('[data-form-success]');
        success.hidden = false;
        success.querySelector('[data-receipt]').textContent = 'Номер обращения: ' + result.receipt;
        success.focus();
        requestId = crypto.randomUUID();
      } catch (error) {
        notice.textContent = error.name === 'TimeoutError' ? 'Ответ задерживается. Попробуй ещё раз: повторная отправка не создаст вторую заявку.' : error.message;
      } finally {
        button.disabled = false;
        turnstile?.reset(widget);
      }
    });
  });
})();
