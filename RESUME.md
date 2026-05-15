# FUSIONPOS Mini-CRM — резюме проекта

Документ-снимок состояния пилота. Цель — чтобы при возврате к работе через
неделю или месяц быстро вспомнить что и как устроено.

Последнее обновление: 14 мая 2026.

---

## 1. Зачем эта CRM

У FUSIONPOS есть биллинг с элементами CRM. Этот пилот делается под **первого
продавца** для:
- сбора структурированных «итогов звонков» по чек-листу из «Скрипта первичного контакта v1» (п.11)
- накопления «золота» — дословных цитат боли клиентов
- визуализации воронки (канбан) и горящих follow-up
- анализа причин отказов (что чинить в продукте)

Принцип: каждый разговор продавца с клиентом = одна запись в `activity`,
карточка клиента в `deals` обновляется.

---

## 2. Стек

| Слой | Технология | Где живёт |
|---|---|---|
| Сервер | Ubuntu (Selectel VPS) | `139.100.204.216` |
| Веб-сервер | Nginx | `/etc/nginx/sites-available/crm-api` |
| Backend-язык | PHP 8.3 (php-fpm) | `/var/www/crm-api/` |
| API-движок | [PHP-CRUD-API v2](https://github.com/mevdschee/php-crud-api) (mevdschee/main) | `/var/www/crm-api/api.php` (~12000 строк, single-file) |
| БД | MariaDB | localhost:3306, БД `fusionpos_crm` |
| Frontend | Один HTML-файл (~2400 строк, vanilla JS, без сборки) | `/var/www/crm-api/crm_api.html` |
| Авторизация | Basic Auth (Nginx) + X-API-Key + таблица users в БД | system |
| Защита | ufw + fail2ban | system |

Доступ к CRM: `http://139.100.204.216/crm_api.html`
Доступ к API: `http://139.100.204.216/records/...` (с заголовком `X-API-Key`)
Эндпоинт текущего юзера: `http://139.100.204.216/whoami`

---

## 3. Файлы на сервере

```
/var/www/crm-api/
  ├── api.php             — PHP-CRUD-API библиотека (НЕ редактировать)
  │                         ⚠ Хвост файла (блок «// file: src/index.php» в конце)
  │                         был УДАЛЁН. Он автоматически выполнялся при require_once
  │                         и генерировал двойной ответ от API.
  ├── api.include.php     — entry point для PHP-CRUD-API. Подключает api.php,
  │                         читает config.php, инициализирует API.
  ├── whoami.php          — мини-эндпоинт. Возвращает {login: "..."} из Basic Auth.
  │                         Тоже читает config.php.
  ├── config.php          — единый источник секретов (api_token, креды БД).
  │                         chmod 640, owner=root, group=www-data.
  └── crm_api.html        — фронтенд. В строках 912-913 подставлены API_URL='' и API_TOKEN.

/etc/nginx/
  ├── sites-available/crm-api  — конфиг Nginx (Basic Auth + статика + PHP-эндпоинты)
  ├── sites-enabled/crm-api    — симлинк на sites-available
  └── .htpasswd                — пользователи Basic Auth (хеши паролей)
```

### Особенности Nginx-конфига

- `auth_basic` на уровне server — Basic Auth работает на ВСЁ (фронт + API + whoami)
- `location = /api.php { deny all; }` — закрыли библиотеку от прямого доступа
- `location = /api.include.php { ... }` и `location = /whoami.php { ... }` — два разрешённых PHP-эндпоинта
- `location = /whoami { rewrite ^ /whoami.php last; }` — красивый URL без `.php`
- Все остальные `.php` запрещены через `location ~ \.php$ { deny all; }`
- Статика отдаётся через `try_files $uri @api;` — если файл есть на диске, отдаётся он, иначе уходит в `api.include.php`

---

## 4. База данных

**База:** `fusionpos_crm` (utf8mb4 для русского текста и эмодзи)

**Пользователи MariaDB:**
- `crm_api@'localhost'` — используется API, имеет права только на `fusionpos_crm.*`
- `root@'localhost'` — для админских операций
- `php-crud-api@'localhost'` — был создан в процессе отладки, не используется. Можно удалить:
  ```sql
  DROP USER 'php-crud-api'@'localhost';
  ```

### Таблицы

**`users`** — пользователи системы. Связан с Basic Auth логином по полю `login`.
- `id` (INT PK AUTO_INCREMENT) — используется как `seller_id` в deals/activity
- `login` (VARCHAR UNIQUE) — должен совпадать с логином в `/etc/nginx/.htpasswd`
- `full_name` (VARCHAR) — отображается в шапке и в сделках
- `email`, `phone` (NULL) — на будущее
- `role` (`seller` / `admin`)
- `is_active` (TINYINT)
- `created_at`

Сейчас в users: 1 запись — `login='crm', full_name='Малышевский Алексей', role='admin'`.

**`deals`** — карточки клиентов, по одной строке на клиента.
Колонки сгруппированы по смыслу:
- Идентификация: `id` (VARCHAR, формата `d_xxx_yyy`), `created_at`, `updated_at`
- Продавец: `seller_id` (INT NULL, FK→users.id ON DELETE SET NULL), `seller` (VARCHAR, legacy)
- Клиент: `client_name`, `phone`, `type`, `points`, `stage`, `open_date`, `current_system`
- Боль и потребности: `pain_quote`, `needs` (JSON-строка в TEXT), `needs_text`
- Квалификация: `temperature` (hot/warm/cold), `dm`, `dm_is_speaker`, `revenue`, `plan`, `hardware`
- Воронка: `status`, `next_step`, `next_date`
- Биллинг FUSIONPOS: `fp_client_id`, `fp_domain`, `fp_version`
- Отказы: `rejection_category`, `rejection_reason`, `rejection_reason_other`, `rejection_quote`, `can_reanimate`, `reanimate_after_date`
- Архив: `archived_at` (soft delete)

**`activity`** — лента касаний, N строк на одну сделку:
- `id`, `deal_id`, `created_at`, `seller_id` (FK→users.id), `seller` (legacy)
- `type` (call/meeting/demo/proposal/invoice/note)
- `summary`, `status_after`, `temperature_after`, `next_step`, `next_date`

**`pain_quotes`** — накопительная история цитат боли:
- `id`, `deal_id`, `activity_id`
- `client_name`, `venue_type`, `current_system`
- `quote`, `created_at`

⚠ Колонка `seller` (текстовая) в deals и activity осталась для backcompat, но **новые
записи в неё не пишут** — только `seller_id`. Можно дропнуть после убеждения,
что нигде не используется.

---

## 5. Авторизация и безопасность

### Текущая модель

**Два слоя авторизации:**

1. **Basic Auth на уровне Nginx** — браузер просит логин/пароль при первом заходе
   на сайт. Запоминается на сессию. Хеши паролей в `/etc/nginx/.htpasswd`.
2. **X-API-Key** — захардкоженный токен в `config.php` (бэк) и в `crm_api.html` (фронт).
   Каждый запрос к API требует его.

**Связь с пользователями:**
- При загрузке страницы фронт идёт в `/whoami` → получает login из Basic Auth
- Затем идёт в `/records/users` → строит словарь userById
- Находит себя по login → подставляет имя в шапке
- При сохранении сделок/касаний пишет `seller_id = currentUser.id`

### Что защищено

- ✅ MariaDB слушает только localhost
- ✅ Пользователь `crm_api` имеет права только на свою БД
- ✅ Basic Auth перед любым запросом к сайту/API
- ✅ X-API-Key обязателен в каждом API-запросе
- ✅ ufw открыт только на 22, 80, 443
- ✅ fail2ban защищает SSH от перебора
- ✅ debug-режим PHP-CRUD-API ОТКЛЮЧЁН
- ✅ `config.php` имеет права 640 root:www-data
- ✅ Удалённый доступ к БД — через SSH-туннель

### Что НЕ защищено

- ⚠ HTTP без HTTPS — Basic Auth и токен передаются в открытом виде. Обязательно
  прикрутить Let's Encrypt перед публичной работой
- ⚠ `cors.allowedOrigins = '*'` — после HTTPS сузить до конкретного origin
- ⚠ Нет автоматического бэкапа БД — настроить mysqldump по cron

### Доступы (записать в безопасное место — не в git!)

- Root MariaDB: свой
- Пользователь crm_api в БД: свой
- X-API-Key: текущий в `config.php`
- Basic Auth: логин `crm` + свой пароль
- Root SSH: свой

---

## 6. Фронтенд crm_api.html — как устроен

Один HTML-файл, ~2400 строк, без сборки. Внутри:

### Главные разделы (вкладки)

- **Дашборд** — статистика (всего, горячие, тёплые, просрочены) + ближайшие 5 follow-up
- **Канбан** — 6 колонок воронки + 2 сворачиваемых блока справа (Отказ, Не сейчас). Drag&drop НЕТ — клик по карточке открывает детали
- **Сделки** — список с фильтрами, поиском, сортировкой, переключателем «Активные / Архив»
- **Цитаты боли** — отдельный фид pain_quotes
- **Отказы** — аналитика: реанимация, по категориям, конкуренты, по конкретным причинам

### Модалка карточки сделки (двухрежимная)

- **view** — детали + кнопки «+ Новое касание», «Редактировать», «В архив» + история касаний
- **edit** — форма по чек-листу п.11. При сохранении: PUT deals, POST activity, опционально POST pain_quotes

### Блок отказа

Показывается ТОЛЬКО при статусе «Отказ». Категория → подпричина (динамически по
категории) → цитата → чекбокс реанимации → дата возврата.

### Текущий юзер

Шапка отображает `Вы: Малышевский Алексей` — берётся из таблицы users по
Basic Auth логину. Если логин в Basic Auth есть, но в users нет — красная надпись
«(не в users)» как сигнал админу.

---

## 7. Известные баги и обходы

### Баг 1: PATCH в PHP-CRUD-API падает с `Invalid parameter number`

**Симптом**: `PATCH /records/deals/{id}` возвращает 500 с `SQLSTATE[HY093]`.
Баг в самой библиотеке (v2 main branch), не починен. Гипотезы про middleware
не подтвердились.

**Обход**: используем **PUT** вместо PATCH. PUT — полная замена, требует
прислать все поля. Фронт сначала делает GET текущей записи, мёрджит изменения,
отправляет PUT. Это +1 GET-запрос, но работает надёжно.

Где в коде crm_api.html: функция `api()`, кейсы `save` и `archive`.

### Баг 2: Двойной JSON-ответ (исправлен)

**Был симптом**: запросы возвращали два склеенных JSON, первый —
`{"code":9999,"message":"PDOException occurred"}` от попытки PHP-CRUD-API
подключиться как пользователь `php-crud-api`, второй — нормальные данные.

**Причина**: в конце `api.php` (с гитхаба) есть блок `// file: src/index.php`,
который автоматически выполняется при `require_once`. Он создавал свой `Api`
со своим конфигом (с захардкоженным юзером `php-crud-api`).

**Решение**: удалили хвост `api.php` начиная со строки `// file: src/index.php`.
Также в crm_api.html есть `parseConcatenatedJson` который берёт последний
валидный JSON-объект — страховка на будущее.

### Баг 3: Пустые строки в числовых полях (исправлен)

**Был симптом**: MariaDB ругалась `Incorrect integer value: '' for column 'points'`.

**Причина**: HTML `input type="number"` отдаёт пустую строку `''` если поле
не заполнено. MariaDB в strict mode такое не принимает.

**Решение**: в функции `serializeDeal` фронта пустые строки для числовых/
булевых/датных полей конвертируются в `null`.

---

## 8. Что входит в «save» — порядок шагов

Клик «Сохранить» в форме итога звонка → 3-4 HTTP-запроса:

1. Если сделка существующая → `GET /records/deals/{id}` (взять текущее состояние для мёрджа)
2. `PUT /records/deals/{id}` (с полным мёрджем) ИЛИ `POST /records/deals` (если новая)
3. `POST /records/activity` (новая запись в истории касаний, с `seller_id`)
4. Если `pain_quote` непустой → `POST /records/pain_quotes`
5. `GET /records/deals/{id}` (получить свежую версию для отображения в карточке)

Скорость: ~300-800 мс на полное сохранение.

---

## 9. Регулярная работа с CRM

- **Доступ продавцу**: ссылка `http://139.100.204.216/crm_api.html` + Basic Auth логин/пароль
- **Регистрация нового продавца**: 
  1. `htpasswd /etc/nginx/.htpasswd <login>` — добавить в Basic Auth
  2. `INSERT INTO users (login, full_name, role) VALUES ('<login>', 'Имя Фамилия', 'seller');` — добавить в БД
- **Прямой доступ к БД**: HeidiSQL/DBeaver через SSH-туннель (`127.0.0.1:3306`, через SSH к 139.100.204.216:22) — для ad-hoc запросов и экспорта

---

## 10. Что было решено и отложено

### Сделано
- ✅ Прототип на Google Sheets / Apps Script (отказались, медленно)
- ✅ Развёрнут Ubuntu сервер на Selectel
- ✅ Установлены Nginx + PHP 8.3 + MariaDB
- ✅ Развёрнут PHP-CRUD-API с авторизацией X-API-Key
- ✅ Создана БД, схема, индексы
- ✅ Фронт переписан с JSONP/Apps Script на REST/PHP-CRUD-API
- ✅ Захостили фронт на том же сервере (избавились от mixed content)
- ✅ Починили все баги (двойной JSON, datetime, PATCH→PUT)
- ✅ Basic Auth добавлен
- ✅ Таблица users + FK + связь с deals/activity через `seller_id`
- ✅ `/whoami` эндпоинт + автоподстановка имени в шапке
- ✅ Единый `config.php` для секретов (бэк)

### Обсуждалось, отложено

**Счета на оплату из CRM** — концепт обсуждали, реализацию отложили:

Контекст:
- Два юрлица параллельно (лицензии — НДС 5%, оборудование — НДС 20%)
- Биллинг и 1С работают вручную, API нет
- Решено: пилоту дать пройти 2-3 месяца с продавцом, потом понять реальные
  потребности (сколько счетов в неделю, какие позиции, как бухгалтер ведёт
  нумерацию) и тогда вернуться к реализации.

Если решим делать — концептуально планировалось:
- Таблица `companies` (наши два ООО с реквизитами банка)
- Таблица `invoices` (несколько на сделку, свои номера с возможностью править)
- Реквизиты клиента — возможно через OData с 1С
- PDF — через HTML+браузерная печать (не через PHP-библиотеку)
- Каталог тарифов захардкожен в HTML, можно добавлять произвольные позиции

---

## 11. TODO / Roadmap

### Срочное (при возврате)
- [ ] HTTPS через Let's Encrypt (нужен домен)
- [ ] Сузить CORS с `*` до конкретного origin после HTTPS
- [ ] Бэкап БД по cron (`mysqldump`)
- [ ] Удалить колонку `seller` (legacy) из `deals` и `activity` после убеждения что нигде не используется
- [ ] Удалить пользователя БД `php-crud-api` (`DROP USER`)

### Среднесрочное
- [ ] Кнопка «Выйти» (сейчас Basic Auth, выйти можно только закрыв все окна браузера или приватный режим)
- [ ] Фильтры по продавцу в Сделках/Канбане (когда станет 2+ юзеров)
- [ ] Кэширование users во фронте (сейчас грузится при каждой загрузке страницы — нормально, но можно ускорить)

### По продуктовой логике (придёт от продавца в живой работе)
- [ ] Импорт лидов (CSV / из формы на сайте)
- [ ] Уведомления о просроченных follow-up (email или Telegram-бот)
- [ ] Счета на оплату (см. раздел 10)
- [ ] Аналитика конверсии по типам заведений / источникам

### Долгосрочное / архитектурное
- [ ] Если продавцов станет 3+ — возможно переход на полноценную JWT-авторизацию
- [ ] Перенос на тот же сервер, где биллинг — для упрощения интеграции по OData
- [ ] Возможно, исправить PATCH в PHP-CRUD-API форком или альтернативной библиотекой

---

## 12. Полезные команды на сервере

```bash
# Проверить, что API живой
curl -s -u crm:ПАРОЛЬ -H "X-API-Key: ТОКЕН_ИЗ_config.php" http://localhost/status/ping

# Проверить whoami
curl -s -u crm:ПАРОЛЬ -H "X-API-Key: ТОКЕН_ИЗ_config.php" http://localhost/whoami

# Логи Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# Логи PHP
tail -f /var/log/php8.3-fpm.log

# Перезапустить Nginx после правки конфига
nginx -t && systemctl reload nginx

# Подключиться к БД из консоли
mariadb -u root -p fusionpos_crm

# Список сделок прямо из SQL
mariadb -u root -p fusionpos_crm -e "SELECT id, client_name, status, seller_id, created_at FROM deals WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT 10;"

# Сколько сделок по статусам
mariadb -u root -p fusionpos_crm -e "SELECT status, COUNT(*) FROM deals WHERE archived_at IS NULL GROUP BY status;"

# Сделки с именем продавца через JOIN
mariadb -u root -p fusionpos_crm -e "SELECT d.id, d.client_name, d.status, u.full_name FROM deals d LEFT JOIN users u ON d.seller_id = u.id WHERE d.archived_at IS NULL LIMIT 10;"

# Бэкап БД одной командой
mysqldump -u root -p fusionpos_crm > /root/backup_$(date +%F).sql

# Узнать заблокированные fail2ban IP
fail2ban-client status sshd

# Добавить нового продавца (Basic Auth + БД)
htpasswd /etc/nginx/.htpasswd <login>
mariadb -u root -p fusionpos_crm -e "INSERT INTO users (login, full_name, role) VALUES ('<login>', 'Имя Фамилия', 'seller');"
```

---

## 13. Краткий путь восстановления при катастрофе

Если сервер умер и нужно поднять CRM с нуля:

1. Новый Ubuntu сервер
2. `apt install nginx mariadb-server php-fpm php-mysql apache2-utils`
3. Создать БД `fusionpos_crm` и пользователя `crm_api`
4. Восстановить из бэкапа: `mariadb -u root -p fusionpos_crm < backup_YYYY-MM-DD.sql`
5. Положить из репозитория в `/var/www/crm-api/`:
   - `api.php` (с удалённым хвостом начиная с `// file: src/index.php`)
   - `api.include.php`
   - `whoami.php`
   - `config.php` (со своими паролями)
   - `crm_api.html`
6. Положить `/etc/nginx/sites-available/crm-api` (Nginx-конфиг)
7. Создать `/etc/nginx/.htpasswd` через `htpasswd -c`
8. `chown -R www-data:www-data /var/www/crm-api && chmod 640 /var/www/crm-api/config.php`
9. `ln -s /etc/nginx/sites-available/crm-api /etc/nginx/sites-enabled/`
10. `nginx -t && systemctl reload nginx`
11. Проверить: `curl -u crm:PASS -H "X-API-Key: TOKEN" http://localhost/status/ping`
