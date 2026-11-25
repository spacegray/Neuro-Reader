CREATE TABLE `music_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `moderation_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`block_subject` text NOT NULL,
	`message` text NOT NULL,
	`documentation` text NOT NULL,
	`created` integer NOT NULL,
	`reviewed` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`day` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mod_appeal_day` ON `moderation_appeals` (`subject`,`day`);--> statement-breakpoint
CREATE INDEX `mod_appeal_created` ON `moderation_appeals` (`created`);--> statement-breakpoint
CREATE TABLE `moderation_blocks` (
	`subject` text PRIMARY KEY NOT NULL,
	`blocked_at` integer NOT NULL,
	`released_at` integer
);
--> statement-breakpoint
CREATE TABLE `moderation_contacts` (
	`subject` text NOT NULL,
	`email_key` text NOT NULL,
	PRIMARY KEY(`subject`, `email_key`)
);
--> statement-breakpoint
CREATE INDEX `mod_email` ON `moderation_contacts` (`email_key`);--> statement-breakpoint
CREATE TABLE `moderation_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`reason` text NOT NULL,
	`confidence` integer NOT NULL,
	`strike` integer NOT NULL,
	`created` integer NOT NULL,
	`bucket` integer NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mod_report_dedup` ON `moderation_reports` (`subject`,`reason`,`bucket`);--> statement-breakpoint
CREATE INDEX `mod_report_time` ON `moderation_reports` (`created`);--> statement-breakpoint
CREATE INDEX `mod_subject_date` ON `moderation_reports` (`subject`,`created`);