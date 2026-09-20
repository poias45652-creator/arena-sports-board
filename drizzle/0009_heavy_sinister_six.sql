CREATE TABLE `baseball_research` (
	`key` text PRIMARY KEY NOT NULL,
	`league` text NOT NULL,
	`section` text NOT NULL,
	`entity` text NOT NULL,
	`observed_at` text NOT NULL,
	`source_as_of` text,
	`source_url` text NOT NULL,
	`content_hash` text NOT NULL,
	`payload` text NOT NULL,
	`imported_at` text NOT NULL,
	`batch_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `baseball_research_section_league` ON `baseball_research` (`section`,`league`);