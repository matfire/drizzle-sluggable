import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { createSluggable } from "../src/pg";

const posts = pgTable("posts", {
	id: serial("id").primaryKey(),
	title: text("title").notNull(),
	slug: text("slug").notNull(),
	categoryId: integer("category_id").notNull(),
});

const customPosts = pgTable("custom_posts", {
	postId: serial("post_id").primaryKey(),
	headline: text("headline").notNull(),
	permalink: text("permalink").notNull(),
});

declare const db: never;
declare const existingPost: never;

createSluggable(posts).insert(db, {
	title: "Hello World",
	slug: "hello-world",
	categoryId: 1,
});

createSluggable(posts).update(db, existingPost, {
	title: "Hello Again",
});

createSluggable(customPosts)
	.from("headline")
	.to("permalink")
	.usingIdField("postId")
	.update(db, existingPost, {
		headline: "Configured",
	});

// @ts-expect-error Missing inferred source and destination fields.
createSluggable(customPosts).insert(db, {
	headline: "Missing config",
	permalink: "missing-config",
});

const needsIdConfig = createSluggable(customPosts)
	.from("headline")
	.to("permalink");
// @ts-expect-error Missing inferred id field.
needsIdConfig.update(db, existingPost, {
	headline: "Still missing id",
});
