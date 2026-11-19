CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`body` text NOT NULL,
	`reference_json` text,
	`nickname` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `answers_user_request` ON `answers` (`user_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `answers_question_created` ON `answers` (`question_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `choices` (
	`question_id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "choices_size" CHECK("choices"."size" BETWEEN 180 AND 350 AND "choices"."size" % 5 = 0)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`purpose` text NOT NULL,
	`width` text NOT NULL,
	`target_model` text DEFAULT '' NOT NULL,
	`reference_json` text,
	`nickname` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_user_request` ON `questions` (`user_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `questions_visible_created` ON `questions` (`hidden`,`created_at`);--> statement-breakpoint
CREATE INDEX `questions_user_created` ON `questions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`target_type` text NOT NULL,
	`question_id` text NOT NULL,
	`answer_id` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`answer_id`) REFERENCES `answers`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reports_target" CHECK(("reports"."target_type" = 'question' AND "reports"."answer_id" IS NULL) OR ("reports"."target_type" = 'answer' AND "reports"."answer_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_user_request` ON `reports` (`user_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `reports_status_created` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`question_id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`fit` text NOT NULL,
	`distance_km` real,
	`first_used_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shoes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`size` integer NOT NULL,
	`width` text NOT NULL,
	`fit` text NOT NULL,
	`purpose` text NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "shoes_size" CHECK("shoes"."size" BETWEEN 180 AND 350 AND "shoes"."size" % 5 = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shoes_user_request` ON `shoes` (`user_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `shoes_user_created` ON `shoes` (`user_id`,`created_at`);