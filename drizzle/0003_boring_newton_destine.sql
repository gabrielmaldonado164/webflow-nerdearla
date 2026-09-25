CREATE TABLE `daily_challenges` (
	`date` text PRIMARY KEY NOT NULL,
	`seed` integer NOT NULL,
	`scenarios` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_results` (
	`player_id` text NOT NULL,
	`date` text NOT NULL,
	`score` integer NOT NULL,
	`attempts` integer NOT NULL,
	`accuracy` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`player_id`, `date`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`date`) REFERENCES `daily_challenges`(`date`) ON UPDATE no action ON DELETE no action
);
