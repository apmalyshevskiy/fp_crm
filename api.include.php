<?php
/**
 * FUSIONPOS CRM — entry point для PHP-CRUD-API
 *
 * Все секреты берутся из config.php — один источник правды.
 *
 * Путь на сервере: /var/www/crm-api/api.include.php
 */

require_once __DIR__ . '/api.php';
$cfg = require __DIR__ . '/config.php';

$config = new Tqdev\PhpCrudApi\Config\Config([
    'driver'   => $cfg['db']['driver'],
    'address'  => $cfg['db']['address'],
    'port'     => $cfg['db']['port'],
    'username' => $cfg['db']['username'],
    'password' => $cfg['db']['password'],
    'database' => $cfg['db']['database'],

    'middlewares' => 'cors,apiKeyAuth,sanitation,validation',

    'cors.allowedOrigins' => '*',
    'cors.allowHeaders'   => 'Content-Type,X-API-Key',
    'cors.allowMethods'   => 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'cors.exposeHeaders'  => '',
    'cors.maxAge'         => '1728000',

    'apiKeyAuth.mode'   => 'required',
    'apiKeyAuth.keys'   => $cfg['api_token'],
    'apiKeyAuth.header' => 'X-API-Key',
]);

$request  = Tqdev\PhpCrudApi\RequestFactory::fromGlobals();
$api      = new Tqdev\PhpCrudApi\Api($config);
$response = $api->handle($request);

Tqdev\PhpCrudApi\ResponseUtils::output($response);
