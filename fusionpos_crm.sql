/*
 Navicat Premium Dump SQL

 Source Server         : fp crm
 Source Server Type    : MariaDB
 Source Server Version : 101114 (10.11.14-MariaDB-0ubuntu0.24.04.1)
 Source Host           : localhost:3306
 Source Schema         : fusionpos_crm

 Target Server Type    : MariaDB
 Target Server Version : 101114 (10.11.14-MariaDB-0ubuntu0.24.04.1)
 File Encoding         : 65001

 Date: 21/05/2026 16:54:02
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for activity
-- ----------------------------
DROP TABLE IF EXISTS `activity`;
CREATE TABLE `activity`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `deal_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `seller_id` int(11) NULL DEFAULT NULL,
  `seller` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `status_after` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `temperature_after` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `next_step` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `next_date` date NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_deal`(`deal_id` ASC) USING BTREE,
  INDEX `idx_seller`(`seller_id` ASC) USING BTREE,
  CONSTRAINT `fk_activity_deal` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_activity_seller` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 21 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of activity
-- ----------------------------
INSERT INTO `activity` VALUES (1, 1, '2026-05-16 17:21:45', 1, NULL, 'call', '', 'Первичный контакт', 'warm', '', NULL);
INSERT INTO `activity` VALUES (2, 2, '2026-05-16 17:24:17', 1, NULL, 'call', '', 'Первичный контакт', 'hot', '', NULL);
INSERT INTO `activity` VALUES (3, 1, '2026-05-16 17:28:39', 1, NULL, 'demo', 'Показал программу, понравилось', 'Первичный контакт', 'warm', '', NULL);
INSERT INTO `activity` VALUES (4, 1, '2026-05-16 17:29:23', 1, NULL, 'proposal', 'Отправлено КП №2 на сумму 41 000,00 ₽', '', '', '', NULL);
INSERT INTO `activity` VALUES (5, 2, '2026-05-16 20:31:09', 1, NULL, 'call', '', 'Отказ', 'hot', '', NULL);
INSERT INTO `activity` VALUES (6, 3, '2026-05-16 23:17:22', 1, NULL, 'call', '', '', '', '', NULL);
INSERT INTO `activity` VALUES (7, 3, '2026-05-16 23:52:25', 1, NULL, 'call', '', '', '', '', NULL);
INSERT INTO `activity` VALUES (8, 4, '2026-05-17 00:47:47', 1, NULL, 'note', 'Пока никто не звонил', 'Лид', '', '', NULL);
INSERT INTO `activity` VALUES (9, 5, '2026-05-17 10:54:11', 1, NULL, 'note', 'Заметка куджа пишестя?', 'Лид', '', '', NULL);
INSERT INTO `activity` VALUES (10, 5, '2026-05-17 10:56:37', 1, NULL, 'note', 'Просит больше не звонить', 'Первичный контакт', '', '', NULL);
INSERT INTO `activity` VALUES (11, 4, '2026-05-17 11:17:55', 1, NULL, 'call', '', 'Первичный контакт', '', '', NULL);
INSERT INTO `activity` VALUES (12, 4, '2026-05-17 11:19:10', 1, NULL, 'call', '', 'Первичный контакт', 'warm', '', NULL);
INSERT INTO `activity` VALUES (13, 4, '2026-05-17 11:23:10', 1, NULL, 'call', '', 'Первичный контакт', 'warm', '', NULL);
INSERT INTO `activity` VALUES (14, 4, '2026-05-17 12:15:50', 1, NULL, 'call', '', 'Первичный контакт', 'warm', '', NULL);
INSERT INTO `activity` VALUES (15, 4, '2026-05-17 12:37:25', 1, NULL, 'note', 'Добавил потребность', 'Первичный контакт', 'warm', '', NULL);
INSERT INTO `activity` VALUES (16, 7, '2026-05-18 16:58:08', 1, NULL, 'call', '---', 'Первичный контакт', 'warm', '', '2026-05-25');
INSERT INTO `activity` VALUES (17, 7, '2026-05-20 16:31:19', 1, NULL, 'proposal', 'Отправлено КП №4 на сумму 46 000,00 ₽', '', '', '', NULL);
INSERT INTO `activity` VALUES (18, 4, '2026-05-21 00:45:43', 1, NULL, 'call', 'демо бонусов', 'Демо назначено', 'warm', '', NULL);
INSERT INTO `activity` VALUES (19, 3, '2026-05-21 00:50:22', 1, NULL, 'invoice', 'Ждем через пару дней оплату', 'Счёт выставлен', '', '', NULL);
INSERT INTO `activity` VALUES (20, 5, '2026-05-21 00:52:24', 1, NULL, 'call', '', 'Первичный контакт', '', '', NULL);

-- ----------------------------
-- Table structure for catalog_items
-- ----------------------------
DROP TABLE IF EXISTS `catalog_items`;
CREATE TABLE `catalog_items`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `parent_id` int(11) NULL DEFAULT NULL,
  `name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `price` decimal(12, 2) NULL DEFAULT NULL,
  `vat_rate` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_parent`(`parent_id` ASC) USING BTREE,
  INDEX `idx_active`(`is_active` ASC) USING BTREE,
  CONSTRAINT `fk_catalog_parent` FOREIGN KEY (`parent_id`) REFERENCES `catalog_items` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 15 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of catalog_items
-- ----------------------------
INSERT INTO `catalog_items` VALUES (1, NULL, 'Лицензии', NULL, NULL, NULL, 1, 1, '2026-05-15 20:13:59');
INSERT INTO `catalog_items` VALUES (2, NULL, 'Услуги', NULL, NULL, NULL, 2, 1, '2026-05-15 20:13:59');
INSERT INTO `catalog_items` VALUES (3, NULL, 'Оборудование', NULL, NULL, NULL, 3, 1, '2026-05-15 20:13:59');
INSERT INTO `catalog_items` VALUES (5, 2, 'Настройка кассы и запуск', 'услуга', 5000.00, '5', 1, 1, '2026-05-15 20:14:18');
INSERT INTO `catalog_items` VALUES (6, 2, 'Обучение персонала', 'час', 2500.00, '5', 2, 1, '2026-05-15 20:14:18');
INSERT INTO `catalog_items` VALUES (7, 2, 'Подключение интеграции с банком-эквайером', 'услуга', 5000.00, '5', 3, 1, '2026-05-15 20:14:18');
INSERT INTO `catalog_items` VALUES (8, 3, 'Комплект «Старт»', 'шт', 70000.00, 'no_vat', 1, 1, '2026-05-15 20:14:18');
INSERT INTO `catalog_items` VALUES (9, 3, 'Комплект «Профи»', 'шт', 150000.00, 'no_vat', 2, 1, '2026-05-15 20:14:18');
INSERT INTO `catalog_items` VALUES (10, 3, 'АТОЛ 11Ф', 'шт', 29000.00, 'no_vat', 1, 1, '2026-05-15 21:08:04');
INSERT INTO `catalog_items` VALUES (11, 3, 'АТОЛ 30Ф', 'шт', 26000.00, 'no_vat', 1, 1, '2026-05-15 21:10:21');
INSERT INTO `catalog_items` VALUES (12, 3, 'АТОЛ 150Ф', 'шт', 38000.00, 'no_vat', 1, 1, '2026-05-15 21:11:32');
INSERT INTO `catalog_items` VALUES (14, 2, 'Внедрение под ключ', 'услуга', 200000.00, '5', 1, 1, '2026-05-15 21:13:23');

-- ----------------------------
-- Table structure for deals
-- ----------------------------
DROP TABLE IF EXISTS `deals`;
CREATE TABLE `deals`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP,
  `seller_id` int(11) NULL DEFAULT NULL,
  `seller` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `source` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `client_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `phone` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `contact_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `contact_role` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `points` int(11) NULL DEFAULT NULL,
  `stage` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `open_date` date NULL DEFAULT NULL,
  `current_system` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `pain_quote` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `needs` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `needs_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `temperature` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `contact_is_dm` tinyint(1) NOT NULL DEFAULT 0,
  `revenue` decimal(12, 2) NULL DEFAULT NULL,
  `plan` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `hardware` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `status` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `next_step` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `next_date` date NULL DEFAULT NULL,
  `fp_client_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `fp_domain` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `fp_version` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `rejection_category` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `rejection_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `rejection_reason_other` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `rejection_quote` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `can_reanimate` tinyint(1) NOT NULL DEFAULT 0,
  `reanimate_after_date` date NULL DEFAULT NULL,
  `archived_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE,
  INDEX `idx_archived`(`archived_at` ASC) USING BTREE,
  INDEX `idx_seller`(`seller_id` ASC) USING BTREE,
  CONSTRAINT `fk_deals_seller` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of deals
-- ----------------------------
INSERT INTO `deals` VALUES (1, '2026-05-16 17:21:45', '2026-05-16 17:29:23', 1, NULL, NULL, 'Ромашка', '', NULL, NULL, NULL, 'Кафе', 1, 'Открывается', '2026-07-03', 'С нуля', '', '[\"Касса/ФЗ-54\",\"Честный знак\",\"План зала\",\"Чаевые\"]', '', 'warm', 0, NULL, '', '', NULL, 'КП отправлено', '', NULL, '', '', '', '', '', '', '', 0, NULL, NULL);
INSERT INTO `deals` VALUES (2, '2026-05-16 17:24:17', '2026-05-16 20:31:09', 1, NULL, NULL, 'У моря', '', NULL, NULL, NULL, 'Кальянная', 2, 'Работает', NULL, 'iiko', '', '[\"Касса/ФЗ-54\",\"Склад\",\"ЕГАИС\",\"Честный знак\"]', '', 'hot', 0, NULL, '', '', NULL, 'Отказ', '', NULL, '', '', '', 'Цена / бюджет', 'Дорогое оборудование', '', '', 0, NULL, NULL);
INSERT INTO `deals` VALUES (3, '2026-05-16 23:17:22', '2026-05-21 00:50:22', 1, NULL, NULL, 'La.Luna', '79409999198', NULL, 'Бения Реваз Шалвович', '', 'Ресторан', NULL, '', NULL, '', '', '[]', '', '', 1, NULL, '', '', NULL, 'Счёт выставлен', '', NULL, '', '', '', '', '', '', '', 0, NULL, NULL);
INSERT INTO `deals` VALUES (4, '2026-05-17 00:47:47', '2026-05-21 00:45:43', 1, NULL, 'Регистрация', 'Bizone Lounge', '+7 (903) 964-83-90', 'rr@rr.ru', 'Федченко Дмитрий Станиславович', 'Владелец', 'Кальянная', 1, 'Открывается', NULL, 'С нуля', '', '[\"Касса/ФЗ-54\",\"Склад\",\"Доставка\",\"Честный знак\",\"Лояльность\"]', '', 'warm', 1, NULL, '', '', '', 'Демо назначено', '', NULL, '', '', '', '', '', '', '', 0, NULL, NULL);
INSERT INTO `deals` VALUES (5, '2026-05-17 10:54:11', '2026-05-21 00:52:24', 1, NULL, 'Регистрация', 'У реки', '+7940992222', 'r@r.ru', 'Бения Реваз Шалвович', '', 'Столовая', NULL, '', NULL, '', '', '[]', '', '', 0, NULL, '', '', '', 'Первичный контакт', '', NULL, '', '', '', '', '', '', '', 0, NULL, NULL);
INSERT INTO `deals` VALUES (6, '2026-05-17 11:24:28', '2026-05-17 11:24:28', 1, NULL, 'Регистрация', 'У забора', '+7940999999', 'luna-bronyandex.ru', 'Бения Реваз Шалвович', NULL, 'Фаст-фуд', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, 'Лид', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL);
INSERT INTO `deals` VALUES (7, '2026-05-18 16:58:08', '2026-05-21 13:52:58', 1, NULL, '', 'Супер кафе 2', '+7 (903) 964-83-90', 'rr@rr.ru', 'Федченко Дмитрий Станиславович', 'Владелец', 'Фудтрак', NULL, '', NULL, '', 'Мне надо быструю стистему', '[\"Касса/ФЗ-54\",\"Склад\",\"Доставка\",\"Аналитика\",\"Честный знак\",\"КСО\"]', '', 'warm', 0, NULL, '', '', '', 'КП отправлено', '', NULL, '', '', '4', '', '', '', '', 0, NULL, NULL);

-- ----------------------------
-- Table structure for pain_quotes
-- ----------------------------
DROP TABLE IF EXISTS `pain_quotes`;
CREATE TABLE `pain_quotes`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `deal_id` int(11) NOT NULL,
  `activity_id` int(11) NULL DEFAULT NULL,
  `client_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `venue_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `current_system` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `quote` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_deal`(`deal_id` ASC) USING BTREE,
  INDEX `idx_activity`(`activity_id` ASC) USING BTREE,
  CONSTRAINT `fk_pq_activity` FOREIGN KEY (`activity_id`) REFERENCES `activity` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_pq_deal` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of pain_quotes
-- ----------------------------
INSERT INTO `pain_quotes` VALUES (1, 2, 2, 'У моря', 'Кальянная', 'iiko', 'Дорого', '2026-05-16 17:24:17');
INSERT INTO `pain_quotes` VALUES (2, 7, NULL, 'Супер кафе', 'Фудтрак', '', 'Мне надо быструю стистему', '2026-05-18 16:58:51');

-- ----------------------------
-- Table structure for proposal_items
-- ----------------------------
DROP TABLE IF EXISTS `proposal_items`;
CREATE TABLE `proposal_items`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `proposal_id` int(11) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `catalog_item_id` int(11) NULL DEFAULT NULL,
  `name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `quantity` decimal(10, 3) NOT NULL DEFAULT 1.000,
  `price` decimal(12, 2) NOT NULL,
  `vat_rate` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'no_vat',
  `amount` decimal(12, 2) NOT NULL DEFAULT 0.00,
  `vat_amount` decimal(12, 2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_proposal`(`proposal_id` ASC) USING BTREE,
  INDEX `idx_catalog`(`catalog_item_id` ASC) USING BTREE,
  CONSTRAINT `fk_items_catalog` FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_items_proposal` FOREIGN KEY (`proposal_id`) REFERENCES `proposals` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of proposal_items
-- ----------------------------
INSERT INTO `proposal_items` VALUES (1, 1, 1, 10, 'АТОЛ 11Ф', 'шт', 1.000, 29000.00, 'no_vat', 29000.00, 0.00, '2026-05-16 14:27:04');
INSERT INTO `proposal_items` VALUES (2, 1, 2, 5, 'Настройка кассы и запуск', 'услуга', 1.000, 5000.00, '5', 5000.00, 238.10, '2026-05-16 14:27:04');
INSERT INTO `proposal_items` VALUES (5, 2, 1, 12, 'АТОЛ 150Ф', 'шт', 1.000, 38000.00, 'no_vat', 38000.00, 0.00, '2026-05-16 14:39:18');
INSERT INTO `proposal_items` VALUES (6, 3, 1, 14, 'Внедрение под ключ', 'услуга', 1.000, 21000.00, '5', 21000.00, 1000.00, '2026-05-19 16:58:47');
INSERT INTO `proposal_items` VALUES (9, 4, 1, 14, 'Внедрение под ключ', 'услуга', 1.000, 20000.00, '5', 20000.00, 952.38, '2026-05-20 13:31:21');
INSERT INTO `proposal_items` VALUES (10, 4, 2, 11, 'АТОЛ 30Ф', 'шт', 1.000, 26000.00, 'no_vat', 26000.00, 0.00, '2026-05-20 13:31:21');

-- ----------------------------
-- Table structure for proposals
-- ----------------------------
DROP TABLE IF EXISTS `proposals`;
CREATE TABLE `proposals`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `deal_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `valid_until` date NULL DEFAULT NULL,
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `total_amount` decimal(12, 2) NOT NULL DEFAULT 0.00,
  `total_vat` decimal(12, 2) NOT NULL DEFAULT 0.00,
  `total_no_vat` decimal(12, 2) NOT NULL DEFAULT 0.00,
  `seller_id` int(11) NULL DEFAULT NULL,
  `parent_id` int(11) NULL DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_deal`(`deal_id` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE,
  INDEX `fk_proposals_seller`(`seller_id` ASC) USING BTREE,
  INDEX `fk_proposals_parent`(`parent_id` ASC) USING BTREE,
  CONSTRAINT `fk_proposals_deal` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_proposals_parent` FOREIGN KEY (`parent_id`) REFERENCES `proposals` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_proposals_seller` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of proposals
-- ----------------------------
INSERT INTO `proposals` VALUES (1, 2, '2026-05-16', '2026-05-23', '', 'draft', 34000.00, 238.10, 29000.00, 1, NULL, '2026-05-16 14:27:04', '2026-05-16 14:27:04');
INSERT INTO `proposals` VALUES (2, 1, '2026-05-16', '2026-05-23', '', 'draft', 38000.00, 0.00, 38000.00, 1, NULL, '2026-05-16 14:29:23', '2026-05-16 14:29:23');
INSERT INTO `proposals` VALUES (3, 6, '2026-05-19', '2026-05-26', '', 'draft', 21000.00, 1000.00, 0.00, 1, NULL, '2026-05-19 16:58:47', '2026-05-19 16:58:47');
INSERT INTO `proposals` VALUES (4, 7, '2026-05-20', '2026-05-27', '', 'sent', 46000.00, 952.38, 26000.00, 1, NULL, '2026-05-20 13:31:01', '2026-05-20 13:31:01');

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `login` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `phone` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `role` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'seller',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uniq_login`(`login` ASC) USING BTREE,
  INDEX `idx_is_active`(`is_active` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO `users` VALUES (1, 'crm', 'Малышевский Алексей', 'amal@fusionpos.ru', '+79282791795', 'admin', 1, '2026-05-14 21:21:49');
INSERT INTO `users` VALUES (2, 'k.ahmadullin', 'Ахмадуллин Константин', ' k.ahmadullin@fusionpos.ru', NULL, 'seller', 1, '2026-05-15 09:28:41');

SET FOREIGN_KEY_CHECKS = 1;
