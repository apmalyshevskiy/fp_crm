# FUSIONPOS Mini-CRM — резюме проекта

Документ-снимок состояния пилота. Цель — чтобы при возврате к работе через
неделю или месяц быстро вспомнить что и как устроено.

**Последнее обновление: 5 июня 2026.**

---

## 1. Зачем эта CRM

У FUSIONPOS есть биллинг с элементами CRM. Этот пилот делается под **первого
продавца** для:
- сбора структурированных «итогов звонков» по чек-листу из «Скрипта первичного контакта v1»
- накопления «золота» — дословных цитат боли клиентов
- ведения лидов и воронки (канбан) с горящими follow-up
- формирования коммерческих предложений (КП) с печатной формой
- анализа причин отказов (что чинить в продукте)

Принцип: каждый разговор продавца с клиентом = одна запись в `activity`,
карточка клиента в `deals` обновляется. КП — отдельная сущность, привязана к
сделке через `proposal.deal_id`.

---

## 2. Стек

| Слой | Технология | Где живёт |
|---|---|---|
| Сервер | Ubuntu 24 (Selectel VPS) | `139.100.204.216` |
| Веб-сервер | Nginx | `/etc/nginx/sites-available/crm-api` |
| Backend-язык | PHP 8.3 (php-fpm) | `/var/www/crm-api/` |
| API-движок | PHP-CRUD-API v2 (mevdschee/main) | `/var/www/crm-api/api.php` (~12000 строк, single-file) |
| БД | MariaDB | localhost:3306, БД `fusionpos_crm` |
| Frontend | Один HTML-файл (~5000 строк, vanilla JS, без сборки) | `/var/www/crm-api/fp_crm.html` |
| Авторизация | Basic Auth (Nginx) + X-API-Key + таблица users в БД | system |
| Защита | ufw + fail2ban | system |

**Доступ к CRM:** `http://139.100.204.216/fp_crm.html`
**Доступ к API:** `http://139.100.204.216/records/...` (заголовок `X-API-Key`)
**Эндпоинт текущего юзера:** `http://139.100.204.216/whoami`

---

## 3. Файлы на сервере

```
/var/www/crm-api/
  ├── api.php             — PHP-CRUD-API библиотека (НЕ редактировать)
  │                         ⚠ Хвост файла (блок «// file: src/index.php» в конце)
  │                         был УДАЛЁН. Он автоматически выполнялся при require_once
  │                         и генерировал двойной ответ от API.
  ├── api.include.php     — entry point. Подключает api.php, читает config.php
  ├── whoami.php          — мини-эндпоинт. Возвращает {login: "..."} из Basic Auth
  ├── config.php          — единый источник секретов (api_token, креды БД)
  │                         chmod 640, owner=root, group=www-data
  └── fp_crm.html         — фронтенд. API_URL='' и API_TOKEN подставлены прямо в код

/etc/nginx/
  ├── sites-available/crm-api  — конфиг (Basic Auth + статика + PHP-эндпоинты)
  ├── sites-enabled/crm-api    — симлинк
  └── .htpasswd                — пользователи Basic Auth
```

### Особенности Nginx-конфига

- `auth_basic` на уровне server — Basic Auth работает на ВСЁ
- `location = /api.php { deny all; }` — закрыли библиотеку от прямого доступа
- `location = /api.include.php` и `location = /whoami.php` — два разрешённых PHP-эндпоинта
- `location = /whoami { rewrite ^ /whoami.php last; }` — красивый URL без `.php`
- Все остальные `.php` запрещены через `location ~ \.php$ { deny all; }`
- `try_files $uri @api;` — если файл на диске есть, отдаём его, иначе уходит в `api.include.php`

---

## 4. База данных

**База:** `fusionpos_crm` (utf8mb4)

**Пользователи MariaDB:**
- `crm_api@'localhost'` — используется API, права только на `fusionpos_crm.*`
- `root@'localhost'` — админ
- `php-crud-api@'localhost'` — legacy, не используется (`DROP USER` можно)

### Все таблицы используют INT AUTO_INCREMENT + FK с ON DELETE CASCADE/SET NULL

Миграция со строковых id (`d_xxx_yyy`) на числовые INT завершена. Связи проверяются на уровне БД, при удалении сделки — каскадно удаляются касания, цитаты и КП.

### Таблицы

**`users`** — пользователи системы
- `id` INT PK — используется как `seller_id` в deals/activity
- `login` UNIQUE — должен совпадать с логином в `/etc/nginx/.htpasswd`
- `full_name`, `email`, `phone` — для печатной формы КП
- `role` (`seller`/`admin`), `is_active`, `created_at`

Сейчас: 1 запись — `login='crm', full_name='Малышевский Алексей', role='admin'`.

**`deals`** — сделки и лиды (единая таблица, разделение по `status`)
- `id`, `created_at`, `updated_at`, `seller_id` (FK→users)
- `source` — источник лида (7 вариантов)
- `client_name`, `phone`, `email` — контакты основного контактного лица
- `company_name`, `inn` — юр. название и ИНН (для строки «Кому» в печатной форме КП). ⚠ добавлены 5 июня — см. миграции в разделе 10
- `contact_name`, `contact_role`, `contact_is_dm` — основной контакт (кто этот человек)
- `contacts` (JSON) — доп. контакты, массив `[{name, role, phone, email, is_dm}]`. ⚠ добавлена 5 июня
- `type`, `points`, `stage`, `open_date` — про заведение
- `current_system`, `pain_quote`, `needs` (JSON), `needs_text`
- `temperature`, `revenue`, `plan`, `hardware`, `comment`
- `status` (`Лид` / `Первичный контакт` / ... / `Отказ` / `Не сейчас`)
- `next_step`, `next_date` — follow-up
- `fp_client_id`, `fp_domain`, `fp_version` — привязка к биллингу
- `rejection_*`, `can_reanimate`, `reanimate_after_date`
- `archived_at` (soft delete)

**`activity`** — история касаний. Одна запись = один звонок/встреча/демо/КП/заметка
- `id`, `deal_id` (FK CASCADE), `created_at`, `seller_id`
- `type` (call/meeting/demo/proposal/invoice/note)
- `summary`, `status_after`, `temperature_after`
- `next_step`, `next_date`

**`pain_quotes`** — цитаты боли (золото)
- `id`, `deal_id` (FK CASCADE), `activity_id` (FK SET NULL)
- `client_name`, `venue_type`, `current_system`, `quote`, `created_at`

**`catalog_items`** — каталог товаров и услуг для КП. Самоссылка через `parent_id`
- `id`, `parent_id` (NULL = категория верхнего уровня)
- `name`, `unit`, `price`, `vat_rate` ('no_vat' / '5')
- `position`, `is_active`, `created_at`

Содержимое:
- **Лицензии** → Лицензия FUSIONPOS (реестр №31687), 3000 ₽/мес, без НДС
- **Услуги** → Настройка кассы 15000, Обучение 3000/час, Подключение эквайера 5000 (все НДС 5%)
- **Оборудование** → Старт 70000, Профи 150000 (оба без НДС)

**`proposals`** — КП. `id` = номер КП
- `id`, `deal_id` (FK CASCADE), `date`, `valid_until`, `comment`
- `status` (draft / sent / cancelled)
- `total_amount`, `total_vat`, `total_no_vat` (денормализовано)
- `seller_id`, `parent_id` (для копий), `created_at`, `updated_at`

**`proposal_items`** — позиции КП
- `id`, `proposal_id` (FK CASCADE), `position`, `catalog_item_id` (FK SET NULL)
- `name`, `unit`, `quantity`, `price`, `vat_rate`
- `amount`, `vat_amount` (с округлением)

---

## 5. Авторизация

### Двойная защита: Basic Auth + X-API-Key

1. **Basic Auth (Nginx)** — пускает на сайт вообще. Логин/пароль из `.htpasswd`
2. **X-API-Key (PHP-CRUD-API)** — нужен заголовок при обращении к API

Фронт делает Basic Auth прозрачно через браузер. X-API-Key добавляется в каждый запрос JS-кодом.

### Поток определения пользователя

1. `loadCurrentUser()` → `GET /whoami`
2. `whoami.php` смотрит `$_SERVER['PHP_AUTH_USER']` (от Nginx) → возвращает `{login: "crm"}`
3. Фронт ищет в `usersById` юзера с таким login → это `currentUser`
4. В шапке отображается `currentUser.full_name`
5. При сохранении — используется `currentUser.id` как `seller_id`

Если Basic Auth login есть, но в `users` его нет — `currentUser.id = null` и работа с предупреждением (имя красным).

---

## 6. Frontend — fp_crm.html (~5000 строк)

Vanilla JS, без сборки. Один файл.

### Вкладки
- **Дашборд** — счётчики (Лиды / Сделки / Горячие / Тёплые / Срочно) + ближайшие 5 follow-up
- **Лиды** — список лидов с фильтрами (Без касаний / >3 дней) и сортировкой
- **Канбан** — 7 колонок воронки (Первичный контакт → Не дозвон → Демо назначено → Демо проведено → КП отправлено → Счёт выставлен → Оплачено) + блоки «Отказ»/«Не сейчас». Лидов нет
- **Сделки** — список всех сделок (без лидов) с поиском, фильтрами, архивом
- **Цитаты боли** — собранные цитаты с метаданными
- **Отказы** — статистика по категориям и причинам

### Шапка
- Имя текущего продавца (из `/whoami`)
- Кнопки «+ Новый лид» (secondary) и «+ Новая сделка» (primary)

### Карточка сделки (модалка)
- View-режим: все поля, кнопки действий, блок КП, история касаний
- Edit-режим: форма редактирования
- Для лидов — кнопка «🤝 Принять в работу» (перевод в «Первичный контакт»)
- Блок «Коммерческие предложения» с кнопкой «+ Новое КП»

### Форма редактирования сделки — порядок полей
1. Клиент / Телефон
2. Название компании (для КП) / ИНН (для КП)
3. Email / Контактное лицо
4. Должность / [✓] Этот контакт — ЛПР
5. Дополнительные контакты — повторяемый список (имя / должность / телефон / email / ЛПР), кнопка «+ Добавить контакт»
6. Формат заведения / Кол-во точек
7. Стадия / Дата открытия
8. Источник
9. Что используют сейчас, Цитата боли, Потребности, доп.текст
10. Температура
11. Оборот / Тариф
12. Оборудование
13. Комментарий
14. Статус (включая «Лид» первым)
15. FP Client ID, FP Domain, Версия FP
16. Блок отказа (при status=Отказ)
17. Следующий шаг + дата (+ быстрые кнопки: 15 мин / 30 мин / час / 2 часа / завтра / неделя)
18. Резюме звонка

### Модалка «+ Новый лид» (упрощённая)
- Источник * (обязательно)
- Название / Телефон / Email / Контактное лицо / Тип / Заметка
- Сохраняет deals.status='Лид', заметка → activity типа 'note'

### Модалка КП
- Шапка: дата, действительно до, комментарий
- Таблица позиций с datalist-автодополнением (формат «Категория — Наименование»)
- Расчёты НДС «изнутри» (vat = amount × 5/105) в реальном времени
- Итоги: Без НДС / В т.ч. НДС / Всего
- Кнопки: «Сохранить как черновик» / «Сохранить и отправить»
- Редактирование: PUT proposals + DELETE+POST позиций

### Печатная форма КП
- Открывается в новом окне через `window.open`
- Чистый HTML, изолировано от CRM
- `@media print` — A4, 18mm/16mm
- Шапка: FUSIONPOS + продавец из users
- Блок «Кому»: берёт «Название компании» (фолбэк на «Клиент / название») + строка «ИНН», если заполнен
- Печать через стандартный Ctrl+P → Save as PDF

### UX-доработки (внесены 17 мая)

- **Телефон**: CSS-селектор включает `tel`/`email`. `type="tel"`, `inputmode="tel"`, `autocomplete="tel"`, placeholder `+7 (999) 123-45-67`. Автоформат: ведущая `8` → `+7`
- **Email**: мягкая валидация — подсветка красным при blur, снимается при коррекции, блокирует сохранение с toast'ом. Пустой email допустим
- **Касание при сохранении**:
  - Резюме заполнено → касание создаётся
  - Резюме пустое → диалог «Добавить касание / Сохранить без касания»
  - При «Добавить» — отдельный диалог запрашивает текст + тип
  - Сервер получает флаг `skip_activity`, блок activity обёрнут в условие
- **Кастомная `showDialog()`** заменила `confirm`/`prompt`. Возвращает Promise, поддерживает Esc/Enter
- **Select типа касания** в диалоге: Звонок / Встреча / Демо / Отправка КП / Выставлен счёт / Заметка

---

## 7. Ключевые JS-функции

Глобальные:
- `currentUser`, `usersById`, `catalog` (byId/categories/loaded), `deals`, `quotes`
- `LEAD_STATUS = 'Лид'`, `FUNNEL_STATUSES`, `SIDE_STATUSES`
- `isLead(d)`, `isArchived(d)`, `activeDeals()`, `activeLeads()`

Рендеры:
- `render()` — главный диспетчер
- `renderDashboard`, `renderKanban`, `renderDeals`, `renderLeads`, `renderQuotes`
- `renderModalView`, `setModalMode('view'|'edit')`

Сохранение:
- Главная save-логика в `api()` под `save`
- `acceptLead(dealId)` — перевод лида в «Первичный контакт»
- `saveNewLead()` — POST лида + опциональная заметка

КП:
- `openProposalForm`, `openEditProposal`
- `calcRow`, `calcTotals`, `round2`, `fmtMoney`
- `updateRowCalcs`, `updateTotals` (обновление UI без потери фокуса)
- `saveProposal(statusValue)` — POST/PUT в proposals + позиции
- `postProposalActivity`, `maybeAdvanceDealStatus`
- `printProposal`, `buildProposalPrintHtml`
- `rebuildCatalogDatalist`

Утилиты:
- `parseConcatenatedJson` в `rest()` — страховка от двойного JSON
- `showDialog` — кастомная модалка
- `formatPhone` — автоформатёр телефона

---

## 8. Известные баги и обходы

### PHP-CRUD-API PATCH не работает
- Симптом: `SQLSTATE[HY093] Invalid parameter number`
- **Обход:** PUT с GET+merge. Шаблон:
  ```js
  const existing = await rest('GET', '/records/deals/' + id);
  const merged = Object.assign({}, existing, changes);
  delete merged.id;
  await rest('PUT', '/records/deals/' + id, merged);
  ```

### Двойной JSON-ответ от API (исправлен)
- Хвост `api.php` со строкой `// file: src/index.php` автоматически выполнялся
- Удалили хвост. `parseConcatenatedJson` в `rest()` остался страховкой

### Пустые строки в numeric/boolean/date полях (исправлен)
- `serializeDeal` конвертирует `''` → `null` для:
  - NUMERIC: points, revenue, seller_id
  - BOOLEAN: contact_is_dm, can_reanimate
  - DATE/DATETIME поля

### Поиск сделки по id
- id числовой, dataset.id строка → `Number(x.id) === Number(id)` везде

### Флаг skip_activity не должен попасть в deals
- Фронт передаёт `skip_activity: true` если касание не нужно
- Сервер вычищает флаг перед записью в БД, использует как условие

---

## 9. Секреты

В `config.php` (chmod 640, root:www-data):
- `api_token`: `fpos_x7Kj9mNqR3vL2pWdF8sH-GIx9CIHFXjnw`
- DB user: `crm_api`, пароль — у пользователя

В `.htpasswd`:
- Логин: `crm`, пароль — у пользователя

Пароль `root` MariaDB и `root` SSH — у пользователя.

---

## 10. Что сделано в текущем спринте

### Этап — Коммерческие предложения (КП)
1. ✅ Концепт в `PROPOSAL_CONCEPT.md`
2. ✅ Каталог товаров и услуг (`catalog_items` с самоссылкой)
3. ✅ Блок «КП» в карточке сделки
4. ✅ Форма создания с datalist-автодополнением
5. ✅ Расчёты НДС «изнутри» (две ставки: no_vat и 5%)
6. ✅ Сохранение (POST/PUT)
7. ✅ Авто-перевод статуса сделки в «КП отправлено»
8. ✅ Запись в activity при отправке
9. ✅ Печатная форма (HTML → Ctrl+P → PDF)
10. ✅ Мягкое редактирование (draft без вопросов, sent через confirm)

### Этап — Миграция id на INT
1. ✅ Все таблицы на INT AUTO_INCREMENT
2. ✅ FK с ON DELETE CASCADE/SET NULL
3. ✅ Фронт переделан под INT id (Number() везде)

### Этап — Контакты и Email
1. ✅ Контактное лицо (имя, должность, ЛПР-чекбокс)
2. ✅ Email клиента
3. ✅ Поиск по контакту, email, комментарию

### Этап — Лиды
1. ✅ Статус «Лид» — нулевой этап
2. ✅ Отдельный таб «Лиды» с фильтрами
3. ✅ Упрощённая модалка «+ Новый лид»
4. ✅ Кнопка «🤝 Принять в работу»
5. ✅ 7 источников лидов

### Этап — UX-полировка (17 мая)
1. ✅ Поля телефона: формат, валидация, автозамена 8→+7
2. ✅ Мягкая валидация email на blur
3. ✅ Логика «касание только если есть резюме»
4. ✅ Кастомная `showDialog()`
5. ✅ Select типа касания в диалоге

### Этап — Доработки по фидбэку продавца (5 июня)
1. ✅ Канбан: перенос карточки сразу меняет этап, без диалога «тип касания / резюме». Смена этапа авто-логируется в `activity` как заметка «Перенос на этап «X»» (`moveDealStatus`)
2. ✅ «Следующий шаг — когда»: быстрые кнопки 15 мин / 30 мин / час / 2 часа / завтра / неделя (завтра и неделя ставятся на 10:00) — `initNextQuick`
3. ✅ Календарь: позиция прокрутки сохраняется при перерисовке (после переноса события больше не отбрасывает наверх) — правка в `renderCalendar`
4. ✅ Поля «Название компании» (`company_name`) и «ИНН» (`inn`) в карточке; используются в строке «Кому» печатной формы КП + добавлена строка «ИНН»
5. ⏸ Автопоиск контрагента по ИНН — **НЕ реализован, отложено**. Обсудили два пути: DaData (бесплатно ~10k запросов/сут, но API-токен пришлось бы держать на клиенте) и «открытые данные ФНС» (бесплатного официального API «ИНН→название» нет — только платная подписка на XML-дамп ЕГРЮЛ либо сторонние API типа egrul.org с лимитом 100/сут). В коде фронта кнопки/интеграции нет — есть только сами поля `company_name` и `inn` (пункт 4)
6. ✅ Множественные контакты — блок «Дополнительные контакты» (`addContactRow`), хранятся JSON-массивом в колонке `contacts` по образцу `needs`, а НЕ отдельной таблицей. Парсинг — `parseContacts`
7. ✅ Поиск расширен: ищет также по `company_name`, `inn` и доп. контактам
8. ✅ Канбан: новая колонка **«Не дозвон»** сразу после «Первичный контакт» (добавлена в `FUNNEL_STATUSES` + в селект статуса). Миграция БД не нужна — `deals.status` это `varchar(64)`

⚠ **Требуются миграции БД** — без них сохранение сделки упадёт (PHP-CRUD-API пишет только в существующие колонки):

```sql
ALTER TABLE deals ADD COLUMN company_name VARCHAR(255) NULL AFTER client_name;
ALTER TABLE deals ADD COLUMN inn          VARCHAR(20)  NULL AFTER company_name;
ALTER TABLE deals ADD COLUMN contacts     TEXT         NULL AFTER contact_role;
```

ИНН хранится как `VARCHAR` (не число) — иначе теряются ведущие нули и 12-значные ИНН ИП. Если после ALTER поля не сохраняются — сбросить кеш схемы PHP-CRUD-API (перезапуск `php8.3-fpm`).

---

## 11. Обсуждалось, но отложено

### Отправка КП по email (Яндекс)
- PHPMailer для SMTP `smtp.yandex.ru:465` + IMAP-копия в Sent
- HTML в теле письма (без PDF-вложения)
- Открытые вопросы: единый ящик или личные, нужно ли PDF, пароль приложения Яндекса
- Что сделать: колонки `sent_to_email`/`sent_at`, эндпоинт `send_proposal.php`, кнопка «📧 Отправить по email»
- Оценка: 1 рабочий день (единый ящик) / 2 дня (личные)

### Счета на оплату
- Дать пилоту пройти 2-3 месяца, потом понять реальные потребности
- Концептуально: `companies` (наши два ООО) + `invoices` (несколько на сделку)

### Импорт лидов из CSV
- Полезная фича когда продавец получит список 50 контактов с выставки или 2GIS
- Отложили до момента когда такой кейс реально появится

---

## 12. TODO / Roadmap

### Срочное при возврате
- [ ] **Применить миграции БД от 5 июня** (`company_name`, `inn`, `contacts` в `deals` — см. раздел 10). Пока не применены — сохранение сделки в новой версии фронта будет падать
- [ ] HTTPS через Let's Encrypt (нужен домен)
- [ ] Сузить CORS с `*` до конкретного origin
- [x] **Бэкап БД и конфигов на Selectel S3** — настроен 17 мая (см. раздел 17 ниже)
- [ ] Заполнить контакты в users (email, phone) — для печатной формы КП:
  ```sql
  UPDATE users SET email = '...', phone = '+7 ...' WHERE login = 'crm';
  ```
- [ ] Удалить пользователя БД `php-crud-api` (legacy)
- [ ] Удалить старую колонку `seller` (legacy текстовый) если нигде не используется

### Долгосрочное / архитектурное
- [ ] При продавцах 3+ → JWT-авторизация вместо Basic Auth
- [ ] **Рефакторинг fp_crm.html (~5000 строк)** — разнести JS на ES-модули:
  config / api / users / catalog / deals / activity / proposals / ui-render / modal.
  Триггер: когда добавление новой фичи замедлится из-за поиска в файле.
  Без сборщика — `<script type="module">` и import'ы. 2-3 часа работы
- [x] Множественные контакты на клиента — сделано 5 июня через JSON-колонку `contacts` (не отдельной таблицей; для пилота достаточно)
- [ ] Доп. контакты: вывод в печатную форму КП + учёт в чек-листе заполнения карточки
- [ ] ИНН: валидация контрольной суммы (10/12 цифр) — сейчас принимается как есть
- [ ] Автопоиск контрагента по ИНН — **не реализован**. Если понадобится: либо DaData (быстро, но токен на клиенте → лучше через прокси на бэкенде, чтобы ключ был на сервере), либо платный XML-дамп ЕГРЮЛ от ФНС с импортом в свою БД. Бесплатного официального API «ИНН→название» нет

---

## 13. Полезные команды на сервере

```bash
# Проверить, что API живой
curl -s -u crm:ПАРОЛЬ -H "X-API-Key: ТОКЕН" http://localhost/status/ping

# Проверить whoami
curl -s -u crm:ПАРОЛЬ -H "X-API-Key: ТОКЕН" http://localhost/whoami

# Логи
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
tail -f /var/log/php8.3-fpm.log

# Перезапустить Nginx после правки конфига
nginx -t && systemctl reload nginx

# Подключиться к БД
mariadb -u root -p fusionpos_crm

# Список сделок
mariadb -u root -p fusionpos_crm -e "SELECT id, client_name, status, seller_id, created_at FROM deals WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT 10;"

# Список лидов
mariadb -u root -p fusionpos_crm -e "SELECT id, client_name, source, created_at FROM deals WHERE status = 'Лид' AND archived_at IS NULL ORDER BY created_at DESC;"

# Список КП
mariadb -u root -p fusionpos_crm -e "SELECT id, deal_id, status, total_amount, created_at FROM proposals ORDER BY created_at DESC LIMIT 10;"
```

---

## 14. Документы рядом

В `/mnt/user-data/outputs/`:
- `fp_crm.html` — финальная версия фронта (~5000 строк)
- `RESUME.md` — этот документ
- `PROPOSAL_CONCEPT.md` — концепт КП (реализован)
- `api.include.php`, `whoami.php`, `config.php`, `crm-api.nginx` — серверная часть

---

## 15. Принципы, которые помогали

- **Один шаг — один заход.** БД отдельно, фронт отдельно, проверка после каждого
- **БД — источник правды.** Все ограничения целостности через FK и NOT NULL
- **Никаких id с фронта.** БД сама даёт INT через AUTO_INCREMENT
- **PUT вместо PATCH** — обход бага PHP-CRUD-API
- **`Number(x.id) === Number(y.id)`** — всегда при сравнении
- **Пустая строка → null** для numeric/boolean/date полей перед записью
- **Никаких секретов в этом резюме** — пароли и токены у пользователя
- **Минимально-нужное.** Аналитика, импорты, email — после реальной работы продавца, не вперёд

---

## 16. Что дальше

**Самое важное сейчас — дать продавцу поработать неделю-две.** После этого
вернёмся со списком «вот это бесит / это нужно добавить», и будет понятно куда
двигать систему. Все гипотезы сейчас — это гипотезы.

---

## 17. Бэкап (настроен 17 мая 2026)

### Что бэкапится

Каждую ночь в **03:00**:
1. БД `fusionpos_crm` (mysqldump с триггерами и процедурами)
2. `/var/www/crm-api/` — приложение
3. `/etc/nginx/` — конфиг веб-сервера
4. `/etc/php/8.3/` — настройки PHP
5. `/etc/mysql/` — конфиг MariaDB
6. `/etc/fail2ban/`, `/etc/ufw/`, `/etc/letsencrypt/` — защита и SSL
7. `/etc/crontab`, `/etc/cron.d/` — планировщик
8. `dpkg --get-selections` — список установленных пакетов

### Куда хранится

- **Selectel Object Storage** (S3-совместимый)
  - Endpoint: `s3.ru-7.storage.selcloud.ru`
  - Region: `ru-7`
  - Bucket: `fpcrm`
  - Структура: `s3://fpcrm/YYYY-MM-DD/` (одна папка на день)
  - Lifecycle: удаление через **90 дней** (настроено в кабинете Selectel)
- **Локальная копия** на сервере: `/var/backups/fusionpos/YYYY-MM-DD/`
  - Хранится **7 дней**, потом скрипт чистит
  - Дублирующая страховка на случай если S3 недоступен в момент аварии

### Файлы на сервере

```
/usr/local/bin/backup-crm.sh    — сам скрипт (chmod +x, owner root)
/root/.s3cfg                     — конфиг s3cmd (chmod 600, ключи Selectel)
/root/.mysql-backup.cnf          — пароль mysqldump (chmod 600)
/var/log/backup-crm.log          — лог запусков
```

### Cron

```cron
0 3 * * * /usr/local/bin/backup-crm.sh
```

### Восстановление из бэкапа

Если VPS совсем умер:
1. Создать новый Ubuntu VPS на Selectel
2. Поставить пакеты: `apt install nginx mariadb-server php8.3-fpm php8.3-mysql php8.3-xml s3cmd`
3. Скопировать `/root/.s3cfg` с ключами Selectel (взять из менеджера паролей)
4. Скачать свежий бэкап: `s3cmd sync s3://fpcrm/YYYY-MM-DD/ /tmp/restore/`
5. Восстановить конфиги: `cd / && tar -xzf /tmp/restore/etc-nginx.tar.gz` (и остальные)
6. Создать БД и импорт: `mariadb -u root -p -e "CREATE DATABASE fusionpos_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"` + `gunzip -c /tmp/restore/db.sql.gz | mariadb -u root -p fusionpos_crm`
7. Восстановить приложение: `cd /var/www && tar -xzf /tmp/restore/crm-api.tar.gz`
8. Создать DB-пользователя `crm_api` с теми же правами (пароль из `config.php`)
9. `nginx -t && systemctl reload nginx`
10. Проверить — открыть `http://<новый_ip>/fp_crm.html`

Примерное время восстановления: 1 час с момента «голого» сервера до работающей CRM.

### Проверка работы бэкапа

Раз в 1-2 недели заглядывать в:

```bash
# Лог последних запусков
tail -100 /var/log/backup-crm.log

# Что есть на S3
s3cmd ls s3://fpcrm/

# Локальные копии (должно быть 7 папок)
ls -lh /var/backups/fusionpos/
```

Если в логе перестали появляться строки `Бэкап завершён успешно` — значит cron не работает или скрипт упал. Запустить вручную и посмотреть ошибку.

### Что НЕ бэкапится (намеренно)

- `/var/log/` — растёт бесконечно, восстановление не критично
- `/tmp/`, `/var/tmp/`, `/var/cache/` — мусор и кеши
- `/var/lib/mysql/` — это сырые файлы СУБД, мы вместо этого делаем portable `mysqldump`
- `/usr/`, `/bin/`, `/lib/` — сама ОС, восстанавливается через `apt install`
