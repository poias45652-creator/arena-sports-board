CREATE TABLE `turnstile_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`encrypted_secret` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
