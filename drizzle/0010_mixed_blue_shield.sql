CREATE TABLE `baseball_pregame` (
	`key` text PRIMARY KEY NOT NULL,
	`league` text NOT NULL,
	`date` text NOT NULL,
	`observed_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `baseball_pregame_league_date` ON `baseball_pregame` (`league`,`date`);