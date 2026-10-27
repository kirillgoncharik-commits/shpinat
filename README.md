# Шпинат

Лендинг предпринимательского проекта «Шпинат» для домена **shpinat.club**.

Восемь недель в небольшой группе: свой вопрос, опыт других людей и проверка следующего шага.

## Содержимое

| Путь | Назначение |
| --- | --- |
| `public/index.html` | Главная: формат, программа, команда, Антон Верт и фотогалерея |
| `public/program/index.html` | Полная программа восьми встреч |
| `public/privacy/index.html` | Информация об аналитике и внешних сервисах |
| `public/assets/` | Логотип, иллюстрация и четыре фотографии |
| `public/site-config.js` | Measurement ID веб-потока GA4 |
| `public/_headers` | CSP и noindex только для временных адресов pages.dev |
| `docs/WORK_HANDOFF.md` | Задание на публикацию, подключение GA4 и Search Console |

## Публикация в Cloudflare Pages

- Ветка: `main`.
- Framework preset: None.
- Build command: `exit 0`.
- Build output directory: `public`.
- Custom domain: `shpinat.club`.

Это готовый статический сайт. Сборка и установка зависимостей не нужны.

При загрузке через Direct Upload загружается **содержимое** `public/`, чтобы `index.html` находился в корне публикации.

## Текущее состояние

Сайт опубликован: **https://shpinat.club/**. Проверено 27 октября 2026 года. Существующий Pages-проект `shpinat-pilot` использует **Direct Upload**; актуальное содержимое `public/` загружено в production. `index.html` находится в корне публикации. HTTPS активен.

Автоматическая публикация из GitHub пока не подключена: существующий Direct Upload проект нельзя переключить на Git integration без создания другого проекта.

GA4 подключён: `G-F6FZB994ZD`, ресурс `560987832`, веб-поток `16214225075`, часовой пояс `Europe/Belgrade`. В отчёте реального времени подтверждены `page_view` и `booking_click`. Google tag загружается только на разрешённом домене после согласия посетителя. Отказ и отзыв согласия проверены.

Доменный ресурс Search Console `sc-domain:shpinat.club` подтверждён через DNS TXT. Sitemap отправлен. Подробные результаты и незавершённые проверки Google: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Основной домен допускает индексирование. Временные адреса pages.dev получают `X-Robots-Tag: noindex, nofollow`. Sitemap содержит главную и страницу программы.

Все кнопки записи ведут на https://calendly.com/kirillgoncharik/30min.

## Проверка перед публикацией

```sh
python3 scripts/validate_site.py
node --check public/analytics.js
```
