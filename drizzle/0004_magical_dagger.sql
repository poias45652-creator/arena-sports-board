CREATE TABLE `hr_connections` (
	`member_id` text PRIMARY KEY NOT NULL,
	`binding_version` integer NOT NULL,
	`encrypted_session` text,
	`snapshot` text,
	`fetched_at` integer,
	`last_error` text,
	`error_code` text,
	`busy_until` integer DEFAULT 0 NOT NULL,
	`operation_id` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `tz_bindings`(`member_id`) ON UPDATE no action ON DELETE cascade
);
