<?php
/**
 * FUSIONPOS CRM — /whoami эндпоинт
 *
 * Возвращает JSON с логином текущего пользователя из Basic Auth.
 * Фронт использует это, чтобы найти юзера в таблице users.
 *
 * Путь на сервере: /var/www/crm-api/whoami.php
 *
 * Защита:
 *   - Basic Auth на уровне Nginx (PHP_AUTH_USER)
 *   - X-API-Key (тот же, что у PHP-CRUD-API — берётся из config.php)
 */

header('Content-Type: application/json; charset=utf-8');

$cfg = require __DIR__ . '/config.php';

// Проверка X-API-Key
$providedToken = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($providedToken !== $cfg['api_token']) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

// PHP_AUTH_USER заполняется Nginx-ом из Basic Auth
$login = $_SERVER['PHP_AUTH_USER'] ?? null;

if (!$login) {
    http_response_code(401);
    echo json_encode(['error' => 'no_basic_auth']);
    exit;
}

echo json_encode([
    'login' => $login,
]);
