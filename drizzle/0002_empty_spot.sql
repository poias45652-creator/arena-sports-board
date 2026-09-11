CREATE TABLE `tz_binding_attempts` (
	`member_id` text PRIMARY KEY NOT NULL,
	`allowed_at` integer NOT NULL,
	`operation_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tz_bindings` (
	`member_id` text PRIMARY KEY NOT NULL,
	`source_user_id` text NOT NULL,
	`username` text NOT NULL,
	`device_id` text NOT NULL,
	`encrypted_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_at` integer NOT NULL
);
