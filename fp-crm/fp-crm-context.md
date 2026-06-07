# FP-CRM — контекст проекта (Vue-переписывание старой CRM)

Документ-handoff: дать в новом чате, чтобы поднять контекст без пересказа.
Статус: **в активной разработке, блок за блоком.** Локально работает; в прод ещё не выкладывался.
Сделано к текущему моменту: дашборд, список, карточка (просмотр/правка/касание), автозаполнение
по ИНН, оба блока КП (список+печать и форма create/edit). Дальше — канбан, календарь, простые
вкладки, форма создания сделки, деплой.

---

## 1. Что это и зачем

`fp-crm` — **отдельный** Vite/Vue-проект (свой `package.json`, своя сборка), постепенно
заменяющий старую одностраничную CRM `fp_crm.html` (~5000 строк ванильного JS).

Принцип: **блок за блоком** при живом старом фронте. «Два фронта» сосуществуют на одной базе:
старый `fp_crm.html` работает как есть, новый `fp-crm` растёт рядом и пишет в те же таблицы.
Данные общие и совместимые.

Самостоятельный проект, не путать с `fp-contracts` (договоры/партнёры) — у того свой
репозиторий и свой контекст. Общего кода нет, общий только бэкенд.

---

## 2. Стек и инфраструктура

- **Vue 3 + Vite** (vite ^8 — свежая мажорная), `<script setup>`.
- **vue-router 4**, hash-режим. Pinia нет — состояние в `ref()`.
- Бэкенд общий: **PHP-CRUD-API (tqdev)**, **MariaDB**, сервер `139.100.204.216`, **nginx**.
- Тема перенесена из старой CRM в `src/style.css`.

### API и авторизация (те же грабли, что на fp-contracts)
- Путь API: **`/records/<table>` БЕЗ `api.php`**.
- Авторизация — **только `X-API-Key`** (токен зашит в `src/api/client.js`). Basic к API не относится.
- `client.js`: `const BASE = import.meta.env.DEV ? '/api' : ''`
  - dev: через Vite-прокси (`/api` → сервер, `rewrite` срезает `/api`, `auth: 'crm:...'`)
  - prod: напрямую на тот же домен.
- `db.list(table,{size,order,filter})` — фильтр вида `deal_id,eq,5` (запятые в %2C — tqdev принимает).
  `get / create(POST) / update(PATCH) / replace(PUT) / remove(DELETE)`.
- **Важно: запись в `deals`/`proposals` идёт через `replace` (PUT)+merge, НЕ через PATCH.**
  PATCH в PHP-CRUD-API падает на малом числе полей (`Invalid parameter number` →
  `code 9999 PDOException`). Паттерн: `GET` записи → `{...existing, ...изменения}` →
  `delete id` → `PUT`. `update`(PATCH) оставлен для таблиц без бага.
- Прокси egrul (автозаполнение по ИНН): в `vite.config.js` рядом с `/api` — блок `/egrul`
  → `target: 'https://egrul.org'`, `changeOrigin: true`, `rewrite` срезает `/egrul`.
  В прод — `egrul.js` сам ходит на `https://egrul.org`.

### Деплой (планируется, как у fp-contracts)
- `vite.config.js` → `base: '/crm/'`, адрес `http://139.100.204.216/crm/`.
- Цикл: `npm run build` → **ОЧИСТИТЬ** папку `crm` на сервере → залить содержимое `dist/` → Ctrl+F5.

---

## 3. Модель данных

Таблицы: **deals** (основная), **activity** (касания), **pain_quotes**, **users**, **catalog_items**.

### deals
client_name, company_name, inn, phone, email, contact_name, contact_role,
type, points, stage, open_date, source, current_system, pain_quote,
needs (JSON-массив строк в TEXT), needs_text, temperature ('hot'|'warm'|'cold'),
revenue, plan, hardware, next_step, next_date, comment, status, seller_id,
archived_at, contacts (JSON-массив `{name,role,phone,email,is_dm}` в TEXT).

- Числовые (points, revenue, seller_id): '' → **null**, иначе Number.
- Даты: next_date — datetime; open_date — date.
- needs/contacts — `JSON.stringify` при записи, `parseJsonArray` при чтении.

### Статусы (lib/deals.js)
- FUNNEL: Первичный контакт, Не дозвон, Демо назначено, Демо проведено, КП отправлено,
  Счёт выставлен, Оплачено. SIDE: Отказ, Не сейчас. LEAD: 'Лид'.
- isArchived (archived_at), isLead (status='Лид'), isDeal (не архив и не лид),
  isOverdue (next_date<now && status не Оплачено/Отказ).

### activity (касание)
deal_id, created_at, seller_id, type (call|meeting|demo|proposal|invoice|note),
summary, status_after, temperature_after, next_step, next_date.

### pain_quotes
deal_id, activity_id, client_name, venue_type, current_system, quote, created_at.

### proposals (КП) + proposal_items + catalog_items
- **proposals**: deal_id, date, valid_until, comment, status ('draft'|'sent'|'cancelled'),
  total_amount, total_vat, total_no_vat, seller_id, created_at.
- **proposal_items**: proposal_id, position, catalog_item_id, name, unit, quantity, price,
  vat_rate ('no_vat'|'5'), amount, vat_amount. При правке КП удаляются и пересоздаются.
- **catalog_items**: id, parent_id (NULL = категория), name, unit, price, vat_rate, position,
  is_active. Форма КП грузит `is_active,eq,1`, строит datalist «Категория — Позиция».
- НДС считается «изнутри» цены: `сумма × r/(100+r)`. Ставки: Без НДС и 5%.

---

## 4. Ключевое решение — логика касания

В старой CRM касание делал серверный код одним вызовом. У нас прямой доступ к API, поэтому
касание = **3 последовательных запроса**:
1. `PUT /records/deals/:id` (GET+merge, через `db.replace`) — status, temperature, next_step,
   next_date. **Раньше был PATCH — заменён на PUT из-за бага tqdev (см. разделы 2 и 7).**
2. `POST /records/activity` — запись касания (забираем новый id).
3. Если цитата боли > 5 символов — `POST /records/pain_quotes` с `activity_id`.

Поля совпадают с тем, что писал сервер → история единая для обоих фронтов.
**Не атомарно** (если 2-й запрос упадёт — рассинхрон); для одного пользователя приемлемо, флаг.
**Статус меняется ТОЛЬКО через касание**, не правкой поля (как в старой CRM).

---

## 5. Структура (src/)

```
src/
├── main.js, App.vue (каркас + вкладки), style.css
├── api/client.js        # обёртка API (list/get/create/update/replace/remove)
├── lib/
│   ├── deals.js         # ЧИСТЫЕ помощники + справочники
│   ├── proposals.js     # ЧИСТЫЕ помощники КП + печатная форма (buildProposalPrintHtml)
│   └── inn/             # автозаполнение по ИНН: index.js (реестр) + egrul.js (провайдер)
├── router/index.js      # hash-роутер
├── components/
│   ├── ProposalsBlock.vue  # список КП в карточке + печать
│   └── ProposalForm.vue    # модалка создания/редактирования КП
└── views/
    ├── DashboardView.vue
    ├── DealsView.vue     # список
    ├── DealCard.vue      # МОДАЛКА (view/edit/touch) + блок КП
    └── StubView.vue      # заглушка
```

lib/proposals.js: proposalStatusLabel/Color, fmtMoney/fmtMoney2, VAT_RATES,
calcRow/calcTotals/round2, ADVANCE_BLOCKED_STATUSES, buildProposalPrintHtml.
lib/inn: `lookupByInn(inn)` → {provider, data}; провайдер меняется одной строкой `ACTIVE`.

lib/deals.js: константы (FUNNEL_STATUSES, SIDE_STATUSES, LEAD_STATUS, ALL_STATUSES, TYPES,
STAGES, SOURCES, ROLES, PLANS, HARDWARE, CURRENT_SYSTEMS, TEMPS, NEEDS, ACTIVITY_TYPES,
ACTIVITY_LABEL, TEMP) + функции (isArchived/isLead/isDeal/isOverdue, fmtDate/fmtDateShort,
dealMatches, parseJsonArray).

Вкладки (App.vue): Дашборд · Лиды · Канбан · Календарь · Сделки · Цитаты боли · Отказы.
Непортированные → StubView (меняем заглушку на экран, навигацию не трогаем).

---

## 6. Что готово / что осталось

### Готово (локально)
- **Дашборд**: 5 счётчиков (Лиды/Всего сделок/Горячие/Тёплые/Срочно) + ближайшие follow-up.
- **Список сделок**: поиск, фильтры (Все/Горячие/Тёплые/Холодные/Срочно/Архив), сортировка
  (Новые сверху / По касанию). Фильтрация на клиенте (size 1000).
- **Карточка-модалка** (× / Esc / клик по фону; в режимах правки и касания закрытие по фону
  заблокировано). Три режима:
  - просмотр: поля + блок КП + История касаний;
  - правка: все поля + справочники + чипы потребностей + доп. контакты +
    **автозаполнение по ИНН** (кнопка у поля ИНН, egrul.org → «ООО "Имя"» / «ИП ФИО») +
    быстрые кнопки времени у «Когда» + **чек-лист заполненности** (12 пунктов, реактивный);
  - новое касание: тип/статус/температура/резюме/цитата боли/след. шаг + быстрые кнопки времени.
- **Запись сделки через PUT+merge** (`db.replace`) — касание, правка, перевод статуса. PATCH убран.
- **Коммерческие предложения (КП)** в карточке:
  - список (ProposalsBlock): № · дата, комментарий, сумма, статус-бейдж;
  - печать (Печать / Печать + тарифы) — печатная форма в новом окне, перенесена из старой CRM;
  - форма (ProposalForm): создание/редактирование, позиции из каталога или руками, НДС/итоги,
    черновик/отправить. При отправке → касание типа `proposal` + сделка двигается в «КП отправлено».
- **Тема**: кнопки `.primary` и чипы потребностей — чёрные (как в старой CRM). Чек-лист — зелёные галочки.

### Осталось (по приоритету)
1. **Канбан** — колонки = статусы, drag-and-drop = смена статуса (переиспользует логику касания, PUT).
2. **Календарь** — по next_date, тоже drag-and-drop (тоже через `db.replace`).
3. Простые вкладки: **Лиды**, **Цитаты боли**, **Отказы**.
4. В карточке ещё не перенесено: «Восстановить из архива», продавец (нет «текущего пользователя» —
   seller_id у КП/касаний берётся из `deal.seller_id`), **форма создания** нового лида/сделки
   (сейчас только правка существующих).
5. **Чёрная тема — только в карточке** (scoped). Для всего приложения вынести
   `button.primary{...}` в `src/style.css`, тогда scoped-override из DealCard можно убрать.
6. **Деплой** в прод (`/crm/`).

---

## 7. Грабли, на которых обожглись

- Перепутанные файлы при раскладке (дашборд показывал список). Проверка: 1-я строка файла —
  комментарий с его именем; не совпало → вставлен не тот код.
- Забыли `vue-router` → `Failed to resolve import "vue-router"`; ставить в папке проекта.
- Клик «в никуда»: карточка стала модалкой, а DealsView остался со старым `router.push`.
- Пустая строка в числовых (points/revenue) → ошибка MariaDB; лечится `'' → null`. То же с пустыми
  датами (next_date/open_date `''`) — тоже `'' → null`.
- **PATCH в PHP-CRUD-API** на малом числе полей → `Invalid parameter number` →
  `code 9999 PDOException`. Лечится PUT+merge (`db.replace`). Касается deals и proposals.
- **egrul 404 в dev** — не добавлен прокси `/egrul` в `vite.config.js` (или нет `rewrite`,
  тогда уходит на `/egrul/egrul/...`). После правки конфига перезапустить `npm run dev`.
- Новый компонент не подхватился: `Failed to resolve import ".../ProposalsBlock.vue"` —
  файла нет на диске / не создана папка `src/components` / неверный регистр имени.

### Повторяющийся паттерн
Форма `form` (+ v-model) → запись → перечитать. Запись в deals/proposals — `db.replace`(PUT)
с GET+merge (PATCH глючит); в activity/pain_quotes/proposal_items — `db.create`(POST).
Один компонент-модалка в нескольких режимах через `mode`/`v-if`.
КП: ProposalsBlock (список+печать, в карточке) ↔ ProposalForm (модалка create/edit поверх карточки),
чистые расчёты и печать — в lib/proposals.js.
