# Шпинат

Сайт восьминедельной предпринимательской группы: **https://shpinat.club/**.

Исходники: `public/` (статические страницы), `functions/api/` (Cloudflare Pages), `worker/` (закрытый обработчик заявок), `migrations/` (D1 lead log). Дизайн, программа, команда, фото, GA4 и Calendly сохранены из существующего сайта.

Страницы: `/`, `/program/`, `/apply/`, `/contact/`, `/privacy/`; неизвестные адреса возвращают 404.

```sh
npm test
npm run check
```

Зависимости для сайта не нужны. Для backend tests требуется Node 22+ с `node:sqlite`.

Production branch — `main`. Существующий Pages-проект **shpinat-pilot**, Direct Upload. Автоматическая публикация из GitHub не подключена. Публиковать через Wrangler из чистого checkout; Dashboard upload не компилирует Pages Functions.

Подробности доставки форм, аналитики, UTM, runtime configuration, privacy, дальнейших экспериментов: [docs/growth-funnel.md](docs/growth-funnel.md). Исходный запуск и подтверждённые настройки GA4/Search Console: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Текущий production readback: [docs/growth-qa.md](docs/growth-qa.md).
