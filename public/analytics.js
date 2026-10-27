'use strict';
(() => {
  const config = window.SHPINAT_CONFIG || {};
  const measurementId = config.ga4MeasurementId || '';
  const isProduction = (config.analyticsHosts || []).includes(location.hostname);
  const isConfigured = /^G-[A-Z0-9]+$/.test(measurementId) && isProduction;
  const banner = document.querySelector('[data-consent-banner]');
  const settings = document.querySelector('[data-consent-settings]');
  const key = 'shpinat.analytics-consent.v1';
  let choice = null;
  let loaded = false;
  try { choice = localStorage.getItem(key); } catch (_) {}
  if (!isConfigured) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied'
  });

  function enableAnalytics() {
    window['ga-disable-' + measurementId] = false;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    if (loaded) return;
    loaded = true;
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_flags: 'SameSite=Lax;Secure'
    });
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    tag.id = 'shpinat-google-tag';
    document.head.appendChild(tag);
  }

  function clearAnalyticsCookies() {
    document.cookie.split(';').forEach(part => {
      const name = part.split('=')[0].trim();
      if (name !== '_ga' && !name.startsWith('_ga_')) return;
      ['', 'shpinat.club', '.shpinat.club', location.hostname].forEach(domain => {
        document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax; Secure' + (domain ? '; domain=' + domain : '');
      });
    });
  }

  function apply(next) {
    choice = next;
    try { localStorage.setItem(key, next); } catch (_) {}
    if (next === 'granted') enableAnalytics();
    else {
      window['ga-disable-' + measurementId] = true;
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
      clearAnalyticsCookies();
    }
    if (banner) banner.hidden = true;
  }

  if (settings) {
    settings.hidden = false;
    settings.addEventListener('click', () => {
      if (!banner) return;
      banner.hidden = false;
      banner.querySelector('button')?.focus();
    });
  }
  document.querySelector('[data-consent-accept]')?.addEventListener('click', () => apply('granted'));
  document.querySelector('[data-consent-reject]')?.addEventListener('click', () => apply('denied'));
  if (choice === 'granted') enableAnalytics();
  else if (choice !== 'denied' && banner) banner.hidden = false;

  document.addEventListener('shpinat:booking-click', event => {
    if (choice !== 'granted' || !loaded) return;
    const placement = event.detail?.placement;
    if (!['header', 'hero', 'program', 'final', 'program-page'].includes(placement)) return;
    window.gtag('event', 'booking_click', {
      placement,
      link_url: 'https://calendly.com/kirillgoncharik/30min',
      transport_type: 'beacon'
    });
  });
})();
