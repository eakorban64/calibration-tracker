CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`action` text NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`link` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_time` ON `activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`equipment_id` text NOT NULL,
	`record_id` text,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`key` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attachments_equipment` ON `attachments` (`equipment_id`);--> statement-breakpoint
CREATE TABLE `calibration_records` (
	`id` text PRIMARY KEY NOT NULL,
	`equipment_id` text NOT NULL,
	`cert_number` integer NOT NULL,
	`short_code` text NOT NULL,
	`cal_date` text NOT NULL,
	`technician` text NOT NULL,
	`procedure` text DEFAULT '' NOT NULL,
	`temperature` real,
	`temperature_unit` text DEFAULT 'C' NOT NULL,
	`humidity` real,
	`result` text NOT NULL,
	`adjusted` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_by` text,
	`updated_at` text,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `records_cert_unique` ON `calibration_records` (`cert_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `records_code_unique` ON `calibration_records` (`short_code`);--> statement-breakpoint
CREATE INDEX `records_equipment` ON `calibration_records` (`equipment_id`,`cal_date`);--> statement-breakpoint
CREATE TABLE `crib_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`equipment_id` text NOT NULL,
	`kind` text NOT NULL,
	`person` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`expected_return` text,
	`condition` text,
	`by_email` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `crib_equipment` ON `crib_movements` (`equipment_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`serial` text DEFAULT '' NOT NULL,
	`manufacturer` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`owner_email` text DEFAULT '' NOT NULL,
	`range` text DEFAULT '' NOT NULL,
	`condition` text DEFAULT 'good' NOT NULL,
	`interval_days` integer NOT NULL,
	`tolerance_notes` text DEFAULT '' NOT NULL,
	`reference_standard` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_cal_date` text,
	`next_due_date` text,
	`last_result` text,
	`holder` text,
	`holder_location` text,
	`expected_return` text,
	`checked_out_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_code_unique` ON `equipment` (`code`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'technician' NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `record_points` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`position` integer NOT NULL,
	`nominal` real NOT NULL,
	`measured` real NOT NULL,
	`lower` real NOT NULL,
	`upper` real NOT NULL,
	`pass` integer NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `calibration_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `points_record` ON `record_points` (`record_id`,`position`);--> statement-breakpoint
CREATE TABLE `reminder_log` (
	`key` text PRIMARY KEY NOT NULL,
	`recipients` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`company_name` text DEFAULT '' NOT NULL,
	`disclaimer` text DEFAULT '' NOT NULL,
	`cert_counter` integer DEFAULT 0 NOT NULL,
	`reminder_mode` text DEFAULT 'off' NOT NULL,
	`reminder_offsets` text DEFAULT '30,14,7,0' NOT NULL,
	`reminder_cc` text DEFAULT '' NOT NULL,
	`digest_weekday` integer DEFAULT 1 NOT NULL,
	`digest_recipients` text DEFAULT '' NOT NULL
);
