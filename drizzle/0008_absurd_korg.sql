CREATE TABLE `baseball_current` (
	`key` text PRIMARY KEY NOT NULL,
	`league` text NOT NULL,
	`date` text NOT NULL,
	`fetched_at` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `baseball_current_league_date` ON `baseball_current` (`league`,`date`);