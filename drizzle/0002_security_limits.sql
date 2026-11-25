CREATE TABLE `provider_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`day` text NOT NULL,
	`actor` text NOT NULL,
	`lookup` text NOT NULL,
	`created` integer NOT NULL,
	`result` text
);
--> statement-breakpoint
CREATE INDEX `provider_daily_total` ON `provider_calls` (`provider`,`day`,`actor`);--> statement-breakpoint
CREATE INDEX `provider_cached_result` ON `provider_calls` (`provider`,`lookup`,`created`);--> statement-breakpoint
CREATE TABLE `request_windows` (
	`actor` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`calls` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_window_expiry` ON `request_windows` (`window`);