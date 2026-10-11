CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient` text NOT NULL,
	`amount` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer NOT NULL,
	`data` text NOT NULL,
	`tx_hash` text,
	`payer` text,
	`block_number` text,
	`paid_at` integer,
	`fee` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_tx_hash_unique` ON `invoices` (`tx_hash`);