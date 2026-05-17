<?php
/**
 * FUSIONPOS CRM — общий конфиг
 *
 * Подключается из api.include.php и whoami.php (и любых будущих PHP-эндпоинтов).
 * Один источник правды для секретов и параметров подключения.
 *
 * Путь на сервере: /var/www/crm-api/config.php
 *
 * Безопасность: chmod 640, owner=root, group=www-data
 */

return [
    // API-токен для X-API-Key (используется и PHP-CRUD-API, и whoami.php)
    'api_token' => 'fpos_x7Kj9mNqR3vL2pWdF8sH-GIx9CIHFXjnw',

    // База данных
    'db' => [
        'driver'   => 'mysql',
        'address'  => 'localhost',
        'port'     => 3306,
        'username' => 'crm_api',
        'password' => 'ПОМЕНЯТЬ_НА_ПАРОЛЬ_CRM_API',
        'database' => 'fusionpos_crm',
    ],
];
