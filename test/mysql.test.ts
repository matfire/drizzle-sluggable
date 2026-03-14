import { int, serial as mysqlSerial, mysqlTable, text as mysqlText } from "drizzle-orm/mysql-core";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import {
  createPool,
  type Pool as MySqlPool,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { createSluggable as createMysqlSluggable } from "../src/mysql";
import { type DBLike, defineDialectSuite, mapSelectRow, type SluggableLike, sleep } from "./shared";

const mysqlPosts = mysqlTable("posts", {
  id: mysqlSerial("id").autoincrement().primaryKey(),
  title: mysqlText("title").notNull(),
  slug: mysqlText("slug").notNull(),
  categoryId: int("category_id").notNull(),
});

defineDialectSuite("mysql", async () => {
  const container = await new GenericContainer("mysql:8.4")
    .withEnvironment({
      MYSQL_DATABASE: "drizzle_sluggable_test",
      MYSQL_ROOT_PASSWORD: "mysql",
    })
    .withExposedPorts(3306)
    .withWaitStrategy(Wait.forLogMessage(/ready for connections/i, 2))
    .withStartupTimeout(120_000)
    .start();

  const pool = await connectMysqlWithRetry(container);

  await pool.execute(`
		CREATE TABLE IF NOT EXISTS posts (
			id INTEGER AUTO_INCREMENT PRIMARY KEY,
			title TEXT NOT NULL,
			slug TEXT NOT NULL,
			category_id INTEGER NOT NULL
		)
	`);

  const db = drizzleMysql(pool);

  return {
    db: db as unknown as DBLike,
    makeSluggable: () =>
      createMysqlSluggable(mysqlPosts, {
        from: "title",
        to: "slug",
      }) as unknown as SluggableLike,
    insertRow: async (values) => {
      const [result] = await pool.execute<ResultSetHeader>(
        "INSERT INTO posts (title, slug, category_id) VALUES (?, ?, ?)",
        [values.title, values.slug, values.categoryId],
      );

      return result.insertId;
    },
    getRow: async (id) => {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT id, title, slug, category_id FROM posts WHERE id = ?",
        [id],
      );

      return mapSelectRow(rows[0]);
    },
    reset: async () => {
      await pool.execute("TRUNCATE TABLE posts");
    },
    close: async () => {
      await pool.end();
      await stopContainer(container);
    },
  };
});

async function connectMysqlWithRetry(container: StartedTestContainer): Promise<MySqlPool> {
  const deadline = Date.now() + 60_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const pool = createPool({
      host: container.getHost(),
      port: container.getMappedPort(3306),
      user: "root",
      password: "mysql",
      database: "drizzle_sluggable_test",
      connectionLimit: 4,
    });

    try {
      await pool.execute("SELECT 1");
      return pool;
    } catch (error) {
      lastError = error;
      await pool.end().catch(() => undefined);
      await sleep(1_000);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Timed out waiting for MySQL to accept connections");
}

async function stopContainer(container: StartedTestContainer) {
  await container.stop({ remove: true, removeVolumes: true });
}
