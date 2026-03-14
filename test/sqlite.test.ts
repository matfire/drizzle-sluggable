import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { integer as sqliteInteger, sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import { createSluggable as createSqliteSluggable } from "../src/sqlite";
import { type DBLike, defineDialectSuite, mapSelectRow, type SluggableLike } from "./shared";

const sqlitePosts = sqliteTable("posts", {
  id: sqliteInteger("id").primaryKey({ autoIncrement: true }),
  title: sqliteText("title").notNull(),
  slug: sqliteText("slug").notNull(),
  categoryId: sqliteInteger("category_id").notNull(),
});

defineDialectSuite("sqlite", async () => {
  const client = createClient({ url: "file::memory:" });

  await client.execute(`
		CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			slug TEXT NOT NULL,
			category_id INTEGER NOT NULL
		)
	`);

  const db = drizzleLibsql(client);

  return {
    db: db as unknown as DBLike,
    makeSluggable: () =>
      createSqliteSluggable(sqlitePosts, {
        from: "title",
        to: "slug",
      }) as unknown as SluggableLike,
    insertRow: async (values) => {
      const result = await client.execute({
        sql: "INSERT INTO posts (title, slug, category_id) VALUES (?, ?, ?)",
        args: [values.title, values.slug, values.categoryId],
      });

      return Number(result.lastInsertRowid);
    },
    getRow: async (id) => {
      const result = await client.execute({
        sql: "SELECT id, title, slug, category_id FROM posts WHERE id = ?",
        args: [id],
      });

      return mapSelectRow(result.rows[0]);
    },
    reset: async () => {
      await client.execute("DELETE FROM posts");
    },
    close: async () => {
      client.close();
    },
  };
});
