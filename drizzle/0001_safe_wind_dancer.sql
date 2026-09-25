CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`player_cards` text NOT NULL,
	`dealer_upcard` text NOT NULL,
	`available_actions` text NOT NULL,
	`user_action` text NOT NULL,
	`optimal_action` text NOT NULL,
	`is_correct` integer NOT NULL,
	`category` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`display_name` text
);
