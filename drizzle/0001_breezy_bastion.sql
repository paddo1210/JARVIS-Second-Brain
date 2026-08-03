CREATE TABLE `api_vault` (
	`owner` text PRIMARY KEY NOT NULL,
	`ciphertext` text NOT NULL,
	`salt` text NOT NULL,
	`iv` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
