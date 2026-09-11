CREATE TABLE `analysis_results` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`away` integer NOT NULL,
	`home` integer NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `analysis_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` integer NOT NULL,
	`start_time` text NOT NULL,
	`captured_at` text NOT NULL,
	`version` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analysis_game_captured` ON `analysis_snapshots` (`game_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `analysis_start` ON `analysis_snapshots` (`start_time`);