CREATE TABLE `account_activity` (
	`subject` text PRIMARY KEY NOT NULL,
	`last_seen` integer NOT NULL,
	`returned_from_idle` integer DEFAULT 0 NOT NULL,
	`minute` integer DEFAULT 0 NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL,
	`elevated_since` integer DEFAULT 0 NOT NULL,
	`extreme_since` integer DEFAULT 0 NOT NULL,
	`burst_at` integer DEFAULT 0 NOT NULL,
	`prolonged_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reader_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `account_closures` (
	`subject` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`created` integer NOT NULL,
	`delivery` text DEFAULT 'inbox' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_closures_id_unique` ON `account_closures` (`id`);--> statement-breakpoint
CREATE INDEX `closure_created` ON `account_closures` (`created`);--> statement-breakpoint
CREATE TABLE `account_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`created` integer NOT NULL,
	`delivery` text DEFAULT 'inbox' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedback_owner_time` ON `account_feedback` (`subject`,`created`);--> statement-breakpoint
CREATE INDEX `feedback_created` ON `account_feedback` (`created`);
--> statement-breakpoint
CREATE TRIGGER prevent_closed_music_profiles_insert BEFORE INSERT ON music_profiles WHEN EXISTS (SELECT 1 FROM account_closures WHERE subject=NEW.user_id) BEGIN SELECT RAISE(ABORT,'Reader profile closed'); END;

--> statement-breakpoint
CREATE TRIGGER prevent_closed_music_profiles_update BEFORE UPDATE ON music_profiles WHEN EXISTS (SELECT 1 FROM account_closures WHERE subject=NEW.user_id) BEGIN SELECT RAISE(ABORT,'Reader profile closed'); END;

--> statement-breakpoint
CREATE TRIGGER prevent_closed_reader_preferences_insert BEFORE INSERT ON reader_preferences WHEN EXISTS (SELECT 1 FROM account_closures WHERE subject=NEW.user_id) BEGIN SELECT RAISE(ABORT,'Reader profile closed'); END;

--> statement-breakpoint
CREATE TRIGGER prevent_closed_reader_preferences_update BEFORE UPDATE ON reader_preferences WHEN EXISTS (SELECT 1 FROM account_closures WHERE subject=NEW.user_id) BEGIN SELECT RAISE(ABORT,'Reader profile closed'); END;

--> statement-breakpoint
CREATE TRIGGER prevent_closed_account_feedback_insert BEFORE INSERT ON account_feedback WHEN EXISTS (SELECT 1 FROM account_closures WHERE subject=NEW.subject) BEGIN SELECT RAISE(ABORT,'Reader profile closed'); END;

--> statement-breakpoint
CREATE TRIGGER prevent_closed_account_feedback_update BEFORE UPDATE ON account_feedback WHEN EXISTS (SELECT 1 FROM account_closures WHERE subject=NEW.subject) BEGIN SELECT RAISE(ABORT,'Reader profile closed'); END;

--> statement-breakpoint
CREATE TRIGGER prevent_closed_account_activity_insert BEFORE INSERT ON account_activity WHEN EXISTS (SELECT 1 FROM account_closures WHERE subject=NEW.subject) BEGIN SELECT RAISE(ABORT,'Reader profile closed'); END;

--> statement-breakpoint
CREATE TRIGGER prevent_closed_account_activity_update BEFORE UPDATE ON account_activity WHEN EXISTS (SELECT 1 FROM account_closures WHERE subject=NEW.subject) BEGIN SELECT RAISE(ABORT,'Reader profile closed'); END;
