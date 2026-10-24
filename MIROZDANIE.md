# «Пни профессора» в Игротеке

Ветка `codex/mirozdanie-integration` содержит экспорт адаптации для существующего Mini App Мироздания. `mirozdanie/integration/web/` накладывается на исходный `web/`; серверный модуль и SQL подключаются в host-проекте. Они не предназначены для отдельного запуска с upstream `npm start`. Пути ниже относятся к каноническому репозиторию `TimaFeyka/mirozdanie`; этот форк сохраняет происхождение и reviewable экспорт.

Источник: [3punch/KickTheBuddyTelegramGame](https://github.com/3punch/KickTheBuddyTelegramGame), commit `2fdfb3a120110dd615237a4c3c66f2320409a292`. Форк: [TimaFeyka/KickTheBuddyTelegramGame](https://github.com/TimaFeyka/KickTheBuddyTelegramGame). Upstream README объявляет MIT; отдельного LICENSE в этой версии нет. Авторство исходной игры сохранено.

Канонические исходники находятся в этом репозитории: неизменённый импорт в `miniapp/kick-buddy/upstream`, изменения клиента в `miniapp/kick-buddy/integration/web`, API в `shared/miniapp/kick-buddy-service.mjs`. `tools/kick-buddy/build.mjs` проверяет SHA-256 импорта и собирает `/kick-buddy/`. `.build` и `dist` служат только результатами сборки и подготовки публикации.

В Игротеке добавлена категория «Аркады», маршрут `#games/kick-buddy` и параметр запуска `game-kick-buddy`. Встроенная страница использует существующую signed-initData авторизацию родительского Mini App, HttpOnly session cookie и тот же допуск по подписке. Raw initData не передаётся в игровые API или ссылки «Поделиться». Telegram использует публичный deep link существующего бота; MAX — `shareContent({text,link})` и публичный deep link существующего бота. Нативный API MAX проверен по https://dev.max.ru/docs/webapps/bridge.

Оба мессенджера сохраняют состояние через `/api/kick-buddy/state` в существующую DB. Профиль привязан к внутреннему user.id; самостоятельного объединения Telegram/MAX аккаунтов по имени нет. При существующем связывании внутренних профилей используется та же идентичность. Локальный cache разделён по user.id; изображения и записи голоса остаются на устройстве. Выбор пользовательского изображения на другом устройстве без этого файла использует стандартный вид.

Загрузка требует успешного чтения серверного состояния. Во время краткого обрыва связи изменения остаются в локальной копии, повторная запись выполняется при восстановлении связи или следующем сохранении. Optimistic revision защищает новое сохранение от старого устройства; конфликт требует перезагрузить игру. Сброс очищает игровой прогресс и настройки этого профиля, сохраняет локальные изображения и не удаляет общий рейтинг. Удаление пользовательских голосовых фрагментов остаётся отдельным действием мастерской.

Рейтинг использует внутренние ID без публикации messenger IDs, недельное окно последних семи суток, ограниченные числовые значения, idempotency UUID и ограничение частоты. Это развлекательный клиентский счёт с базовой защитой от повторов; сервер не воспроизводит физику и не гарантирует защиту от подделанного результата. Реальных платежей, валюты и призов нет.

Новый SQL: `migrations/hosted/0046_kick_buddy.sql`. Он создаёт три таблицы игры и два индекса. Применение согласовывается с OpenClaw `agent:server-admin:main`; публикация сохраняет прежний Site ID, DB binding, reader/announcement и credentials. Старый standalone HTTP server, Telegram webhook/polling и bot-setup из upstream не запускаются.

Локальная проверка:

```sh
./tools/with-node npm run build
./tools/with-node node --test .build/miniapp/tests/kick-buddy-service.test.mjs .build/miniapp/tests/navigation.test.mjs .build/miniapp/tests/kick-buddy-client.test.mjs
cd .build/miniapp
KICK_BUDDY_LOCAL_QA=true APP_ENV=development DEMO_MODE=true DB_PATH=/absolute/path/to/mirozdanie/qa-reports/kick-buddy/demo.sqlite PORT=4188 ../../tools/with-node node server.mjs
```

Флаг QA разрешён только на loopback в demo и с отдельной БД внутри `qa-reports/kick-buddy/`. Runtime production от этой команды не меняется. Результаты визуальной проверки и статус публикации хранятся в `qa-reports/kick-buddy/` и `docs/provenance/kick-buddy-20261024/`.
