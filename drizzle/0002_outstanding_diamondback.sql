CREATE TABLE `coach_usage` (
	`player_id` text NOT NULL,
	`date` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`player_id`, `date`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
