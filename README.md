# @matfire/drizzle-sluggable

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@matfire/drizzle-sluggable)](https://npmx.dev/package/@matfire/drizzle-sluggable) [![Open on npmx.dev](https://npmx.dev/api/registry/badge/license/@matfire/drizzle-sluggable)](https://npmx.dev/package/@matfire/drizzle-sluggable)


> easily generate a slug from a table's fields in drizzle


Generate unique slugs before inserts and updates, with optional scoped uniqueness for things like tenants, categories, or workspaces.

## Install

```sh
npm install @matfire/drizzle-sluggable
```

## Quick start

Pick the helper that matches your Drizzle driver. Public imports are subpath-only:

```ts
import { makeSlugBeforeInsert, makeSlugBeforeUpdate } from "@matfire/drizzle-sluggable/pg";
```

Also available:

```ts
import { makeSlugBeforeInsert } from "@matfire/drizzle-sluggable/mysql";
import { makeSlugBeforeInsert } from "@matfire/drizzle-sluggable/sqlite";
```

The package expects a Drizzle database/client that can perform:

- `db.select(...).from(...).where(...)`
- your normal `db.insert(...)` and `db.update(...)` calls around the returned values

### Example schema

```ts
import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
	id: serial("id").primaryKey(),
	title: text("title").notNull(),
	slug: text("slug").notNull(),
	categoryId: integer("category_id").notNull(),
});
```

### Create a slug before insert

```ts
import { makeSlugBeforeInsert } from "@matfire/drizzle-sluggable/pg";
import { posts } from "./schema";

const values = await makeSlugBeforeInsert({
	db,
	table: posts,
	data: {
		title: "Hello Drizzle",
		categoryId: 1,
	},
	options: {
		source: ["title"],
		slugField: "slug",
		scope: { categoryId: 1 },
	},
});

await db.insert(posts).values(values);
```

If `hello-drizzle` already exists in the same category, the package automatically generates `hello-drizzle-2`, `hello-drizzle-3`, and so on.

### Regenerate a slug before update

```ts
import { eq } from "drizzle-orm";
import { makeSlugBeforeUpdate } from "@matfire/drizzle-sluggable/pg";
import { posts } from "./schema";

const existingPost = await db.query.posts.findFirst({
	where: eq(posts.id, 1),
});

if (!existingPost) throw new Error("Post not found");

const patch = await makeSlugBeforeUpdate({
	db,
	table: posts,
	existing: existingPost,
	patch: {
		title: "Hello Drizzle ORM",
	},
	options: {
		source: ["title"],
		slugField: "slug",
		idField: "id",
		onUpdate: "updateIfSourceChanged",
	},
});

await db.update(posts).set(patch).where(eq(posts.id, existingPost.id));
```

The update helper needs the current row so it can tell whether the source fields changed and so it can exclude that row from the uniqueness check.

### Expected results

- insert `{ title: "Hello Drizzle" }` -> `hello-drizzle`
- insert another `{ title: "Hello Drizzle" }` -> `hello-drizzle-2`
- update title from `Hello Drizzle` to `Hello Drizzle ORM` -> `hello-drizzle-orm`

### Options

| Option | Required | Default | What it does |
| --- | --- | --- | --- |
| `source` | yes | - | Fields to combine, or a function that returns the base string to slugify. |
| `slugField` | yes | - | Column name that receives the generated slug. |
| `scope` | no | none | Limits uniqueness to matching rows, such as the same tenant or category. |
| `separator` | no | `-` | Word separator used by the default slugifier and suffixes. |
| `maxLength` | no | none | Trims the base slug before uniqueness suffixes are applied. |
| `onUpdate` | no | `updateIfSourceChanged` | Controls whether updates regenerate the slug. |
| `reserved` | no | none | Prevents specific final slug values such as `admin` or `new`. |
| `slugify` | no | built-in | Replaces the default slugifier. Signature: `(input, separator) => string`. |
| `customUniqueResolver` | no | built-in | Replaces the default collision strategy that generates `-2`, `-3`, and so on. |
| `idField` | no | `id` | Primary key field used to exclude the current row during updates. |

### Common patterns

#### Scoped uniqueness

```ts
options: {
	source: ["title"],
	slugField: "slug",
	scope: { categoryId: 1 },
}
```

This allows the same slug in different categories while keeping it unique inside each category.

#### Manual slug input

```ts
const values = await makeSlugBeforeInsert({
	db,
	table: posts,
	data: {
		title: "Ignored for slug because one was provided",
		slug: "My Custom URL",
	},
	options: {
		source: ["title"],
		slugField: "slug",
	},
});

// values.slug === "my-custom-url" or "my-custom-url-2"
```

Provided slugs are still normalized and checked for uniqueness.

#### Reserved slugs

```ts
options: {
	source: ["title"],
	slugField: "slug",
	reserved: ["admin", "new"],
}
```

If the generated slug is reserved, the package appends a numeric suffix until it finds an allowed value.

#### Custom slugify

```ts
options: {
	source: ["title"],
	slugField: "slug",
	slugify: (input, separator) =>
		input.trim().toLowerCase().replace(/\s+/g, separator),
}
```

Use this when you need different transliteration or language-specific rules.

### Notes

- The default slugifier lowercases, removes accents, and keeps ASCII letters and numbers. If your app depends on non-Latin transliteration rules, provide a custom `slugify`.
- When the source fields are empty, the package falls back to a timestamp on insert and the row id on update.
- `reserved` values are checked against the final normalized slug value, so define them in the same format you expect in URLs.
- `onUpdate` can be `never`, `updateIfSourceChanged`, or `always`.
