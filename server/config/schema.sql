-- Gates Database Schema
-- Run this script in MySQL to create the database and tables manually

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS gates_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE gates_db;

-- Create gates table
CREATE TABLE IF NOT EXISTS gates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT 'שם השער',
  phone_number VARCHAR(20) NOT NULL COMMENT 'מספר הטלפון של השער',
  authorized_number VARCHAR(20) NOT NULL COMMENT 'מספר הטלפון המורשה לפתיחת השער',
  last_opened_at DATETIME NULL COMMENT 'תאריך הפתיחה האחרון',
  last_call_status VARCHAR(50) NULL COMMENT 'סטטוס השיחה האחרונה',
  last_call_duration INT NULL COMMENT 'משך השיחה האחרונה בשניות',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'האם השער פעיל',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_is_active (is_active),
  INDEX idx_phone_number (phone_number),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='טבלת השערים במערכת';

-- Insert sample data
INSERT INTO gates (name, phone_number, authorized_number, is_active) VALUES
('שער סירקין שטח', '+972527418575', '+972548827828', TRUE),
('שער ראשי', '+1234567890', '+972542070400', TRUE),
('שער צדדי', '+0987654321', '+972542070400', TRUE)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Show the created table
DESCRIBE gates;

-- Show sample data
SELECT * FROM gates;
