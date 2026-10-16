CREATE TABLE `account_login_activity` (
 `member_id` text PRIMARY KEY NOT NULL,
 `last_login_at` integer NOT NULL,
 FOREIGN KEY (`member_id`) REFERENCES `tz_bindings`(`member_id`) ON UPDATE no action ON DELETE cascade
);
