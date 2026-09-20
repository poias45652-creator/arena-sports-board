CREATE TABLE `baseball_log_snapshots` (
	`key` text PRIMARY KEY NOT NULL,
	`league` text NOT NULL,
	`season` integer NOT NULL,
	`observed_at` text NOT NULL,
	`payload` text NOT NULL
);
