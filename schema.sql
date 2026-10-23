-- =============================================================================
-- Multi-Shop Billing Management System
-- Database Schema for MySQL 8.0+
-- Compatible with MySQL Workbench, Localhost (root, no password)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `billing_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `billing_db`;

-- Temporarily disable foreign key checks for clean drop & recreation
SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables in clean order (warnings on first-time run are normal)
DROP TABLE IF EXISTS `bill_items`;
DROP TABLE IF EXISTS `bills`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `shop_profiles`;
DROP TABLE IF EXISTS `users`;

-- -----------------------------------------------------------------------------
-- 1. Table: users
-- Stores both Administrator and Customer shop owner accounts
-- -----------------------------------------------------------------------------
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shop_name` VARCHAR(150) NOT NULL,
  `owner_name` VARCHAR(120) NOT NULL,
  `username` VARCHAR(80) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'customer') NOT NULL DEFAULT 'customer',
  `mobile` VARCHAR(20) NOT NULL,
  `email` VARCHAR(120) NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_username` (`username`),
  INDEX `idx_users_role_status` (`role`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Table: shop_profiles
-- Custom branding, address, contact details, and invoice template configurations
-- -----------------------------------------------------------------------------
CREATE TABLE `shop_profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `brand_name` VARCHAR(150) NOT NULL,
  `owner_name` VARCHAR(120) NOT NULL,
  `logo_path` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `mobile` VARCHAR(20) NOT NULL,
  `email` VARCHAR(120) NULL,
  `bill_header` TEXT NULL,
  `bill_footer` TEXT NULL,
  `terms_conditions` TEXT NULL,
  `currency_symbol` VARCHAR(10) NOT NULL DEFAULT '₹',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_shop_profiles_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Table: products
-- Catalog managed by individual shop owners with support for various units
-- -----------------------------------------------------------------------------
CREATE TABLE `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `sku` VARCHAR(100) NULL,
  `unit` VARCHAR(50) NOT NULL DEFAULT 'Pieces',
  `price_per_unit` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_products_user_status` (`user_id`, `status`),
  INDEX `idx_products_name` (`name`),
  CONSTRAINT `fk_products_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Table: bills
-- Invoices generated for buyers with financial calculations & audit void status
-- -----------------------------------------------------------------------------
CREATE TABLE `bills` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `bill_number` VARCHAR(60) NOT NULL UNIQUE,
  `buyer_name` VARCHAR(150) NOT NULL,
  `buyer_mobile` VARCHAR(20) NOT NULL,
  `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `grand_total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `payment_mode` VARCHAR(50) NOT NULL DEFAULT 'Cash',
  `status` ENUM('completed', 'void') NOT NULL DEFAULT 'completed',
  `void_reason` VARCHAR(255) NULL,
  `bill_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_bills_user_date` (`user_id`, `bill_date`),
  INDEX `idx_bills_buyer_mobile` (`buyer_mobile`),
  INDEX `idx_bills_status` (`status`),
  CONSTRAINT `fk_bills_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Table: bill_items
-- Line item snapshots preserving historical names and prices
-- -----------------------------------------------------------------------------
CREATE TABLE `bill_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `bill_id` INT NOT NULL,
  `product_id` INT NULL,
  `product_name` VARCHAR(200) NOT NULL,
  `unit` VARCHAR(50) NOT NULL DEFAULT 'Pieces',
  `quantity` DECIMAL(10, 3) NOT NULL DEFAULT 1.000,
  `unit_price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  INDEX `idx_bill_items_bill` (`bill_id`),
  CONSTRAINT `fk_bill_items_bill`
    FOREIGN KEY (`bill_id`) REFERENCES `bills` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- INITIAL SEED DATA
-- Default administrator account:
-- Username: admin
-- Password: Admin@2026
-- Password Hash generated with Werkzeug generate_password_hash (scrypt/pbkdf2)
-- =============================================================================

-- Insert Default Administrator Account Only (Customers are added via Admin Console)
INSERT INTO `users` (`id`, `shop_name`, `owner_name`, `username`, `password_hash`, `role`, `mobile`, `email`, `status`)
VALUES (
  1,
  'System Administration',
  'Master Administrator',
  'admin',
  'scrypt:32768:8:1$1kG9dO8qWq47mC8e$c73a00508eb67faea1ba3bfd925ceee4856fdbba609d123ab30438cfda4d348074da81ca8c3b7a58a9e223bfe4c146e27abda88950fe3fa7fc1f24d35c2fa663',
  'admin',
  '9876543210',
  'admin@billingsystem.local',
  'active'
);

-- Verification Query (Shows created admin account in MySQL Workbench Result Grid)
SELECT `id`, `shop_name`, `owner_name`, `username`, `role`, `status`, `created_at` FROM `users`;
