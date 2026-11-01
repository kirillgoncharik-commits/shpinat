# Growth funnel: production QA — 1 ноября 2026

Production: **https://shpinat.club/**. Реальные отправки, получение email и поступление GA4 событий подтверждены; результат не основан только на завершении deploy.

## Изменённые URL

`/`, `/program/`, `/apply/`, `/contact/`, `/privacy/`; обновлены также `/sitemap.xml`, общие стили/скрипты и заголовки безопасности. Новые публичные API: `/api/config` и `/api/lead`.

## Фактические проверки

| Проверка | Результат |
| --- | --- |
| Главная, программа, заявка, вопрос, privacy | HTTP 200 |
| Статические HTML/CSS/JS/изображения, robots и sitemap | Содержимое совпадает с релизным исходником; Cloudflare удаляет только управляющие комментарии `email_off` |
| Неизвестный путь | Настоящий HTTP 404, `noindex` |
| `/apply`, `/program`, `/contact` | 308 на адрес со слешем, итоговый HTTP 200 |
| `/api/config` | HTTP 200, `ready=true`, реальный production sitekey и `call@shpinat.club` |
| Основной домен | Нет общего noindex; robots разрешает обход |
| Canonical, OG/Twitter, H1, alt и schema | Валидатор проверил все шесть HTML-страниц; один H1 на странице; фактические WebSite/Organization/WebPage |
| Sitemap | Содержит главную, программу, apply, contact и privacy |
| Валидация заявки | Пустая форма не отправляется; обязательные ответы, выборы и согласие проверяются браузером и сервером |
| Валидация вопроса | Требуется email или другой контакт, тема, сообщение и согласие |
| Поддельный Turnstile token | Production HTTP 403, обращение не создаётся |
| Посторонний Origin | Production HTTP 403 |
| Нет согласия | Production HTTP 400 |
| Реальная защита | Production Turnstile успешно проверен в Safari; обе формы прошли Siteverify |
| Success state | Обе формы показали номер обращения, затем необязательный Calendly; бронирование не создавалось |
| Мобильная верстка | Все страницы и 404 проверены при ширинах 320/390 px: `scrollWidth == clientWidth`, один H1 |
| Calendly | Открывается `Quick Connect - Kirill G`, 30 min; доступные дни видны на мобильном |
| Прямой email | Обычные `mailto:call@shpinat.club` сохранены в HTML и доступны без JavaScript; клик измеряется |
| Analytics consent | После отказа и reload Google tag отсутствует; после согласия новые события поступают |
| Локальная проверка | 12 backend tests на реальном SQLite; links/anchors/assets/sitemap/meta/schema; JS syntax |

В автоматизированных Chrome/Edge Turnstile сначала выдавал transient challenge error `300030`. Защита не отключалась и тестовые ключи на production не использовались. После разрешённого владельцем прохождения проверки в Safari получены настоящие production-токены и успешно отправлены обе формы. Приложение не показало ошибок выполнения JS; сообщения провайдера защиты не считались подтверждением отправки.

Повторяемый readback: `python3 scripts/readback.py --output /tmp/shpinat-readback.json`. Он выполняет 27 проверок и сверяет опубликованные файлы с checkout. Итоговая публикация привязана к SHA из `main` через `--commit-hash`; фактические deployment ID/SHA дополнительно сохранены в приватном delivery receipt. Исторические Direct Upload публикации без commit metadata не выдаются за актуальные.

## Реально полученные формы

| Тип | Номер обращения | Серверная отправка UTC | Подтверждение |
| --- | --- | --- | --- |
| Вопрос | `3d09cdc4-389a-4757-9448-04437a28b5db` | `2026-11-01T16:11:57.234Z` | Gmail INBOX, тема «ШПИНАТ — Новый вопрос [3d09cdc4]» |
| Заявка | `51ced8ea-01a6-45be-a84d-7173d04bad71` | `2026-11-01T16:15:15.343Z` | Gmail INBOX, тема «ШПИНАТ — Новая заявка [51ced8ea]» |

Оба письма: отправитель `call@shpinat.club`, корректный Reply-To на тестовый email владельца, SPF pass и DKIM pass для shpinat.club. Получены ответы, timestamp, URL, тип, тема/задача, CTA и UTM. D1 подтвердил `notification_status=sent` для обоих номеров; отрицательные проверки строк не добавили. Тестовые записи помечаются `qa_test`, чтобы не считать их реальными кандидатами.

У заявки `page=/apply/` и `cta_location=program-intro`. При этом `landing_page` осталась исходной `/contact/?utm_source=qa&utm_medium=readback&utm_campaign=growth_20261101&utm_content=safari` после перехода через программу. Все четыре UTM сохранились в письме и журнале. Это подтверждает first-touch attribution между страницами, а не только наличие скрытых полей.

## Alias

По прямому запросу владельца создан `call@shpinat.club` с пересылкой на его подтверждённый Gmail. В Cloudflare Routing: Enabled, DNS Locked, одно активное правило literal-to-call → forward. Добавлены только предложенные Cloudflare MX/SPF/DKIM, конфликтующих почтовых записей не было.

Тестовое входящее письмо зарегистрировано в Activity Log как **Forwarded**, 1 ноября 2026 в 17:01:44 CET. При пересылке письма из Gmail в тот же Gmail отдельная копия во «Входящих» не появилась: Gmail убирает такой self-forward duplicate. Уведомления реальных форм пришли отдельными письмами от адреса Шпината и подтверждены во «Входящих».

## GA4

В существующем property `560987832` / stream `G-F6FZB994ZD`, через Realtime подтверждены все семь событий:

- `primary_cta_click` — 1;
- `application_start` — 1;
- `application_submit` — 1;
- `contact_form_start` — 2;
- `contact_form_submit` — 1;
- `email_click` — 1;
- `calendly_click` — 1.

Это минимальные наблюдённые значения во время QA, а не отчёт о реальном наборе. Дополнительно сохранился старый `booking_click`. В drilldown Realtime видны custom event parameters, включая `cta_location`; source/UTM также подтверждены в фактическом письме и D1. `booking_completed` не создавался. Учёт лидов в D1 не зависит от согласия на GA4; аналитические события без согласия не отправляются.

## Мобильная производительность

[PageSpeed Insights, mobile /apply/](https://pagespeed.web.dev/analysis/https-shpinat-club-apply/m1tolgaqq1?form_factor=mobile), 1 ноября 2026, 17:19 CET: Performance **94**, Accessibility **100**, Best Practices **100**, SEO **100**. FCP 1.8 s, LCP 1.8 s, TBT 0 ms, CLS 0. Условия: Moto G Power, Slow 4G, Lighthouse 13.6.0. Это лабораторный замер; полевых CrUX данных пока нет.

## Что осталось за рамками

- Отдельный приватный follow-up: просмотр и обновление статуса/исхода лидов в существующем КириллOS. Текущий журнал и email уже работают; scope передан владельцу отдельным документом.
- Цена, даты, расписание и точный формат первой группы по-прежнему требуют решения команды. В публичном контенте нет фиктивных значений.
- Завершённое бронирование Calendly можно измерять после отдельного проверенного webhook; сейчас измеряется честный переход.

Paid traffic, A/B test, новые SEO/GEO статьи и платные сервисы не запускались.
