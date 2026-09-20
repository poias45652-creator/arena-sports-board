CREATE TABLE `arena_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `tz_bindings`(`member_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `arena_sessions_member` ON `arena_sessions` (`member_id`);--> statement-breakpoint
CREATE INDEX `arena_sessions_expiry` ON `arena_sessions` (`expires_at`);