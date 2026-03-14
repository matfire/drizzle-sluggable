import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import {
  integer as pgInteger,
  serial as pgSerial,
  pgTable,
  text as pgText,
} from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { createSluggable as createPgSluggable } from "../src/pg";
import { type DBLike, defineDialectSuite, mapSelectRow, type SluggableLike } from "./shared";

const pgPosts = pgTable("posts", {
  id: pgSerial("id").primaryKey(),
  title: pgText("title").notNull(),
  slug: pgText("slug").notNull(),
  categoryId: pgInteger("category_id").notNull(),
});

defineDialectSuite("postgres", async () => {
  const container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_DB: "drizzle_sluggable_test",
      POSTGRES_USER: "postgres",
      POSTGRES_PASSWORD: "postgres",
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2))
    .withStartupTimeout(120_000)
    .start();

  const pool = new Pool({
    host: container.getHost(),
    port: container.getMappedPort(5432),
    user: "postgres",
    password: "postgres",
    database: "drizzle_sluggable_test",
  });

  await pool.query(`
		CREATE TABLE IF NOT EXISTS posts (
			id SERIAL PRIMARY KEY,
			title TEXT NOT NULL,
			slug TEXT NOT NULL,
			category_id INTEGER NOT NULL
		)
	`);

  const db = drizzlePg(pool);

  return {
    db: db as unknown as DBLike,
    makeSluggable: () =>
      createPgSluggable(pgPosts, {
        from: "title",
        to: "slug",
      }) as unknown as SluggableLike,
    insertRow: async (values) => {
      const result = await pool.query<{ id: number }>(
        "INSERT INTO posts (title, slug, category_id) VALUES ($1, $2, $3) RETURNING id",
        [values.title, values.slug, values.categoryId],
      );

      return result.rows[0].id;
    },
    getRow: async (id) => {
      const result = await pool.query<{
        id: number;
        title: string;
        slug: string;
        category_id: number;
      }>("SELECT id, title, slug, category_id FROM posts WHERE id = $1", [id]);

      return mapSelectRow(result.rows[0]);
    },
    reset: async () => {
      await pool.query("TRUNCATE TABLE posts RESTART IDENTITY");
    },
    close: async () => {
      await pool.end();
      await stopContainer(container);
    },
  };
});

async function stopContainer(container: StartedTestContainer) {
  await container.stop({ remove: true, removeVolumes: true });
}
