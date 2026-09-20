CREATE TABLE `international_forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`league` text NOT NULL,
	`fixture_key` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`captured_at` text NOT NULL,
	`version` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `international_forecast_fixture_version` ON `international_forecasts` (`fixture_key`,`version`,`captured_at`);--> statement-breakpoint
CREATE INDEX `international_forecast_start` ON `international_forecasts` (`start_time`);