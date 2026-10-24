CREATE TABLE `account_notes` (
 `member_id` text PRIMARY KEY NOT NULL,
 `note` text DEFAULT '' NOT NULL,
 `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `account_preapprovals` (
 `username_key` text PRIMARY KEY NOT NULL,
 `username` text NOT NULL,
 `enabled` integer DEFAULT 1 NOT NULL,
 `expires_at` integer,
 `note` text DEFAULT '' NOT NULL,
 `claimed_member_id` text,
 `claim_token` text,
 `updated_at` integer NOT NULL
);
