# Шпинат

Практическая программа и сообщество для запуска и развития своего дела: **https://shpinat.club/**.

Исходники: `public/` (статические страницы), `functions/api/` (Cloudflare Pages), `worker/` (закрытый обработчик заявок), `migrations/` (D1 lead log). Главная, программа и короткая заявка обновлены 5 ноября 2026. Действующие GA4, UTM, защита и доставка обращений сохранены.

Страницы: `/`, `/program/`, `/apply/`, `/contact/`, `/privacy/`; неизвестные адреса возвращают 404.

```sh
npm test
npm run check
```

Зависимости для сайта не нужны. Для backend tests требуется Node 22+ с `node:sqlite`.

Production branch — `main`. Существующий Pages-проект **shpinat-pilot**, Direct Upload. Автоматическая публикация из GitHub не подключена. Публиковать через Wrangler из чистого checkout; Dashboard upload не компилирует Pages Functions.

Подробности доставки форм, аналитики, UTM, runtime configuration, privacy, дальнейших экспериментов: [docs/growth-funnel.md](docs/growth-funnel.md). Исходный запуск и подтверждённые настройки GA4/Search Console: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Переработка и текущая проверка: [docs/redesign-2026-11-05.md](docs/redesign-2026-11-05.md). Предыдущий production readback: [docs/growth-qa.md](docs/growth-qa.md).
