# @matfire/drizzle-sluggable

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@matfire/drizzle-sluggable)](https://npmx.dev/package/@matfire/drizzle-sluggable) [![Open on npmx.dev](https://npmx.dev/api/registry/badge/license/@matfire/drizzle-sluggable)](https://npmx.dev/package/@matfire/drizzle-sluggable)

> opinionated slug generation for Drizzle ORM

Generate unique slugs for inserts and updates with a table-bound API, sensible defaults, and optional scoped uniqueness.

## Install

```sh
npm install @matfire/drizzle-sluggable
```

## Quick start

```ts
import { createSluggable } from "@matfire/drizzle-sluggable/pg";
import { posts } from "./schema";

const postSlug = createSluggable(posts, {
  from: "title",
  to: "slug",
});

const values = await postSlug.insert(db, {
  title: "Hello Drizzle",
});

await db.insert(posts).values(values);
// values.slug === "hello-drizzle"
```

If another row already uses `hello-drizzle`, the package generates `hello-drizzle-2`, `hello-drizzle-3`, and so on.

## Driver imports

Use the dialect-specific entrypoint that matches your Drizzle client:

```ts
import { createSluggable } from "@matfire/drizzle-sluggable/pg";
import { createSluggable } from "@matfire/drizzle-sluggable/mysql";
import { createSluggable } from "@matfire/drizzle-sluggable/sqlite";
```

The package also exposes named root exports if you prefer one import path for shared utilities:

```ts
import {
  createPgSluggable,
  createMysqlSluggable,
  createSqliteSluggable,
  defaultSlugify,
} from "@matfire/drizzle-sluggable";
```

## Why this API

Instead of passing `table`, `source`, `slugField`, and update behavior on every call, you bind slug rules to a table once and reuse them:

```ts
const postSlug = createSluggable(posts, {
  from: "title",
  to: "slug",
});

await postSlug.insert(db, data);
await postSlug.update(db, existingPost, patch);
```

## Example schema

```ts
import { integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    categoryId: integer("category_id").notNull(),
  },
  (table) => [uniqueIndex("posts_slug_idx").on(table.slug)],
);
```

## Insert

```ts
import { createSluggable } from "@matfire/drizzle-sluggable/pg";

const postSlug = createSluggable(posts, {
  from: "title",
  to: "slug",
});

const values = await postSlug.insert(db, {
  title: "Hello Drizzle",
  categoryId: 1,
});

await db.insert(posts).values(values);
```

## Update

```ts
import { eq } from "drizzle-orm";
import { createSluggable } from "@matfire/drizzle-sluggable/pg";

const postSlug = createSluggable(posts, {
  from: "title",
  to: "slug",
});

const existingPost = await db.query.posts.findFirst({
  where: eq(posts.id, 1),
});

if (!existingPost) throw new Error("Post not found");

const patch = await postSlug.update(db, existingPost, {
  title: "Hello Drizzle ORM",
});

await db.update(posts).set(patch).where(eq(posts.id, existingPost.id));
```

`update()` needs the current row so it can compare source values and exclude that row from the uniqueness check.

If you want less fetch-then-update ceremony, you can pass a promise or loader to `updateFrom()`:

```ts
const patch = await postSlug.updateFrom(
  db,
  () =>
    db.query.posts.findFirst({
      where: eq(posts.id, 1),
    }),
  { title: "Hello Drizzle ORM" },
);
```

## Sensible defaults

`createSluggable(posts)` can infer a few common conventions:

- `to: "slug"` when the table has a `slug` column
- `idField: "id"` when the table has an `id` column
- `from: "title"` or `from: "name"` when one of those columns exists
- update behavior defaults to regenerating only when source fields change

When TypeScript can see those conventions, `insert()` and `update()` become available immediately. Otherwise, configure the missing pieces with `.from(...)`, `.to(...)`, or `.usingIdField(...)`.

Runtime checks still exist and throw clear errors if a required field cannot be inferred.

## Production checklist

- Add a unique index for every slug constraint you rely on.
- Use a composite unique index when slugs are scoped, for example `(category_id, slug)`.
- Treat generated uniqueness as an application-level convenience, not a replacement for database constraints.
- Expect concurrent inserts to race in production without a DB constraint; the index is the final source of truth.

Scoped uniqueness example:

```ts
import { integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    categoryId: integer("category_id").notNull(),
  },
  (table) => [uniqueIndex("posts_category_slug_idx").on(table.categoryId, table.slug)],
);
```

## Recipes

### Scoped uniqueness

Keep slugs unique per category, tenant, workspace, or any other subset of rows.

```ts
const postSlug = createSluggable(posts, {
  from: "title",
  to: "slug",
  scope: ["categoryId"],
});
```

You can also compute the scope yourself:

```ts
const postSlug = createSluggable(posts)
  .from("title")
  .to("slug")
  .withinScope((row) => ({ categoryId: row.categoryId }));
```

### Multiple source fields

Combine several columns into one slug source:

```ts
const postSlug = createSluggable(posts, {
  from: ["title", "categoryId"],
  to: "slug",
});
```

Or compute the source yourself:

```ts
const postSlug = createSluggable(posts)
  .from((row) => `${row.title ?? ""} ${row.categoryId ?? ""}`)
  .to("slug");
```

### Manual slug input

```ts
const postSlug = createSluggable(posts, {
  from: "title",
  to: "slug",
});

const values = await postSlug.insert(db, {
  title: "Ignored for slug because one was provided",
  slug: "My Custom URL",
});

// values.slug === "my-custom-url" or "my-custom-url-2"
```

Provided slugs are still normalized and checked for uniqueness.

### Keep the same slug after updates

```ts
const postSlug = createSluggable(posts).from("title").to("slug").doNotRegenerateOnUpdate();
```

### Always regenerate on updates

```ts
const postSlug = createSluggable(posts).from("title").to("slug").regenerateOnEveryUpdate();
```

### Tenant or workspace scope

```ts
const postSlug = createSluggable(posts)
  .from("title")
  .to("slug")
  .withinScope((row) => ({ workspaceId: row.workspaceId }));
```

### Reserved slugs

```ts
const postSlug = createSluggable(posts).from("title").to("slug").preventSlugs(["admin", "new"]);
```

If the generated slug is reserved, the package keeps adding numeric suffixes until it finds an allowed value.

### Custom slugify

```ts
const postSlug = createSluggable(posts)
  .from("title")
  .to("slug")
  .usingSlugify((input, separator) => input.trim().toLowerCase().replace(/\s+/g, separator));
```

## Builder API

Start with a config object:

```ts
const postSlug = createSluggable(posts, {
  from: "title",
  to: "slug",
  scope: ["categoryId"],
});
```

Or configure it fluently:

```ts
const postSlug = createSluggable(posts)
  .from("title")
  .to("slug")
  .withinScope(["categoryId"])
  .slugsShouldBeNoLongerThan(80);
```

Available builder methods:

- `from(field | fields | fn)`
- `to(field)`
- `withinScope(fields | fn | object)`
- `usingSeparator(separator)`
- `slugsShouldBeNoLongerThan(length)`
- `preventSlugs(values)`
- `usingSlugify(fn)`
- `usingUniqueResolver(fn)`
- `usingIdField(field)`
- `doNotRegenerateOnUpdate()`
- `regenerateOnEveryUpdate()`
- `regenerateOnSourceChange()`
- `updateFrom(db, existing | promise | loader, patch)`

## Testing

This repo uses `vitest` for integration tests:

```sh
npm test
```

- PostgreSQL and MySQL tests run with `testcontainers`, so Docker must be running locally.
- SQLite tests use `@libsql/client` with an in-memory database and do not require Docker.
- Run the full local verification suite with `npm run check`.

## Notes

- The package expects a Drizzle client that can run `db.select(...).from(...).where(...)`.
- The default slugifier lowercases, removes accents, and keeps ASCII letters and numbers.
- When source fields are empty, inserts fall back to a timestamp and updates fall back to the row id.
- `reserved` values are checked against the final normalized slug value.
