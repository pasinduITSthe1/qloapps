-- Database modifications for mobile check-in/check-out functionality
-- Add these columns to the htl_booking_detail table

ALTER TABLE `htl_booking_detail` 
ADD COLUMN `is_checked_in` TINYINT(1) DEFAULT 0 AFTER `check_out`,
ADD COLUMN `is_checked_out` TINYINT(1) DEFAULT 0 AFTER `is_checked_in`,
ADD COLUMN `actual_check_in` DATETIME NULL AFTER `is_checked_out`,
ADD COLUMN `actual_check_out` DATETIME NULL AFTER `actual_check_in`,
ADD COLUMN `check_in_signature` TEXT NULL AFTER `actual_check_out`,
ADD COLUMN `id_verification_method` VARCHAR(50) NULL AFTER `check_in_signature`,
ADD COLUMN `room_condition` VARCHAR(20) DEFAULT 'good' AFTER `id_verification_method`;

-- Add room_status column to room information table if it doesn't exist
ALTER TABLE `htl_room_information` 
ADD COLUMN `room_status` VARCHAR(20) DEFAULT 'available' AFTER `room_num`;

-- Create index for better performance
CREATE INDEX `idx_checkin_status` ON `htl_booking_detail` (`is_checked_in`, `is_checked_out`);
CREATE INDEX `idx_room_status` ON `htl_room_information` (`room_status`);

-- Create table for mobile app logs (for DTCM integration)
CREATE TABLE IF NOT EXISTS `mobile_app_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `event_type` VARCHAR(50) NOT NULL,
  `booking_id` INT(11) NULL,
  `room_id` INT(11) NULL,
  `hotel_id` INT(11) NULL,
  `customer_id` INT(11) NULL,
  `event_data` TEXT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;