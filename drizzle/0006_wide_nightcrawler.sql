CREATE TABLE `account_access` (
	`member_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`expires_at` integer,
	`updated_at` integer NOT NULL
);
