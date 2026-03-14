import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

export type DBLike = {
	select: (...args: never[]) => unknown;
	insert?: (...args: never[]) => unknown;
	update?: (...args: never[]) => unknown;
	delete?: (...args: never[]) => unknown;
};

export type InsertRow = {
	title: string;
	slug?: string;
	categoryId: number;
};

export type SelectRow = {
	id: number;
	title: string;
	slug: string;
	categoryId: number;
};

export type ScopeInput = Partial<InsertRow> & Partial<SelectRow>;

export type SluggableLike = {
	insert(db: DBLike, data: InsertRow): Promise<InsertRow>;
	update(
		db: DBLike,
		existing: SelectRow,
		patch: Partial<InsertRow>,
	): Promise<Partial<InsertRow>>;
	updateFrom(
		db: DBLike,
		existing:
			| SelectRow
			| Promise<SelectRow | null | undefined>
			| (() =>
					| SelectRow
					| null
					| undefined
					| Promise<SelectRow | null | undefined>),
		patch: Partial<InsertRow>,
	): Promise<Partial<InsertRow>>;
	from(
		source:
			| keyof InsertRow
			| (keyof InsertRow)[]
			| ((row: ScopeInput) => string),
	): SluggableLike;
	to(field: keyof InsertRow): SluggableLike;
	withinScope(
		scope:
			| (keyof InsertRow)[]
			| ((row: ScopeInput) => Record<string, unknown> | undefined),
	): SluggableLike;
	usingSlugify(
		slugify: (input: string, separator: string) => string,
	): SluggableLike;
	doNotRegenerateOnUpdate(): SluggableLike;
	regenerateOnEveryUpdate(): SluggableLike;
	preventSlugs(reserved: string[]): SluggableLike;
	slugsShouldBeNoLongerThan(maxLength: number): SluggableLike;
};

export type DialectHarness = {
	db: DBLike;
	makeSluggable(): SluggableLike;
	insertRow(values: Required<InsertRow>): Promise<number>;
	getRow(id: number): Promise<SelectRow>;
	reset(): Promise<void>;
	close(): Promise<void>;
};

export function defineDialectSuite(
	name: string,
	createHarness: () => Promise<DialectHarness>,
) {
	describe(name, () => {
		let harness: DialectHarness;

		beforeAll(async () => {
			harness = await createHarness();
		});

		beforeEach(async () => {
			if (!harness) {
				return;
			}

			await harness.reset();
		});

		afterAll(async () => {
			if (!harness) {
				return;
			}

			await harness.close();
		});

		it("creates a unique slug on insert", async () => {
			const sluggable = harness.makeSluggable();

			const first = await sluggable.insert(harness.db, {
				title: "Hello World",
				categoryId: 1,
			});
			await harness.insertRow(asPersistedInsert(first));

			const second = await sluggable.insert(harness.db, {
				title: "Hello World",
				categoryId: 1,
			});

			expect(first.slug).toBe("hello-world");
			expect(second.slug).toBe("hello-world-2");
		});

		it("scopes uniqueness when configured", async () => {
			const sluggable = harness.makeSluggable().withinScope(["categoryId"]);

			const first = await sluggable.insert(harness.db, {
				title: "Scoped Post",
				categoryId: 1,
			});
			await harness.insertRow(asPersistedInsert(first));

			const second = await sluggable.insert(harness.db, {
				title: "Scoped Post",
				categoryId: 2,
			});

			expect(first.slug).toBe("scoped-post");
			expect(second.slug).toBe("scoped-post");
		});

		it("supports computed scope functions", async () => {
			const sluggable = harness
				.makeSluggable()
				.withinScope((row) => ({ categoryId: row.categoryId }));

			const first = await sluggable.insert(harness.db, {
				title: "Function Scoped Post",
				categoryId: 1,
			});
			await harness.insertRow(asPersistedInsert(first));

			const second = await sluggable.insert(harness.db, {
				title: "Function Scoped Post",
				categoryId: 2,
			});

			expect(first.slug).toBe("function-scoped-post");
			expect(second.slug).toBe("function-scoped-post");
		});

		it("supports multiple source fields", async () => {
			const sluggable = harness
				.makeSluggable()
				.from(["title", "categoryId"])
				.to("slug");

			const values = await sluggable.insert(harness.db, {
				title: "Multi Source",
				categoryId: 7,
			});

			expect(values.slug).toBe("multi-source-7");
		});

		it("supports computed source functions", async () => {
			const sluggable = harness
				.makeSluggable()
				.from((row) => `${row.title ?? ""} category ${row.categoryId ?? ""}`)
				.to("slug");

			const values = await sluggable.insert(harness.db, {
				title: "Function Source",
				categoryId: 3,
			});

			expect(values.slug).toBe("function-source-category-3");
		});

		it("normalizes provided slugs and resolves collisions", async () => {
			const sluggable = harness.makeSluggable();

			const first = await sluggable.insert(harness.db, {
				title: "Ignored",
				slug: "My Custom URL",
				categoryId: 1,
			});
			await harness.insertRow(asPersistedInsert(first));

			const second = await sluggable.insert(harness.db, {
				title: "Ignored Again",
				slug: "My Custom URL",
				categoryId: 1,
			});

			expect(first.slug).toBe("my-custom-url");
			expect(second.slug).toBe("my-custom-url-2");
		});

		it("regenerates on update only when the source changes by default", async () => {
			const sluggable = harness.makeSluggable();

			const created = await sluggable.insert(harness.db, {
				title: "Initial Title",
				categoryId: 1,
			});
			const id = await harness.insertRow(asPersistedInsert(created));
			const existing = await harness.getRow(id);

			const unchangedPatch = await sluggable.update(harness.db, existing, {
				categoryId: 2,
			});
			expect(unchangedPatch.slug).toBeUndefined();

			const changedPatch = await sluggable.update(harness.db, existing, {
				title: "Updated Title",
			});

			expect(changedPatch.slug).toBe("updated-title");
		});

		it("can keep the same slug on updates", async () => {
			const sluggable = harness.makeSluggable().doNotRegenerateOnUpdate();

			const created = await sluggable.insert(harness.db, {
				title: "Stable Title",
				categoryId: 1,
			});
			const id = await harness.insertRow(asPersistedInsert(created));
			const existing = await harness.getRow(id);

			const patch = await sluggable.update(harness.db, existing, {
				title: "Completely Different Title",
			});

			expect(patch.slug).toBeUndefined();
		});

		it("can always regenerate and still keep slugs unique", async () => {
			const defaultSluggable = harness.makeSluggable();
			const alwaysSluggable = harness.makeSluggable().regenerateOnEveryUpdate();

			const first = await defaultSluggable.insert(harness.db, {
				title: "Hello World",
				categoryId: 1,
			});
			const firstId = await harness.insertRow(asPersistedInsert(first));

			const second = await defaultSluggable.insert(harness.db, {
				title: "Hello World",
				categoryId: 1,
			});
			await harness.insertRow(asPersistedInsert(second));

			const existing = await harness.getRow(firstId);
			const patch = await alwaysSluggable.update(harness.db, existing, {
				categoryId: 2,
			});

			expect(patch.slug).toBe("hello-world");
		});

		it("can load the existing row inside the update helper", async () => {
			const sluggable = harness.makeSluggable();

			const created = await sluggable.insert(harness.db, {
				title: "Inline Fetch",
				categoryId: 1,
			});
			const id = await harness.insertRow(asPersistedInsert(created));

			const patch = await sluggable.updateFrom(
				harness.db,
				() => harness.getRow(id),
				{
					title: "Inline Fetch Updated",
				},
			);

			expect(patch.slug).toBe("inline-fetch-updated");
		});

		it("supports reserved slugs and max length constraints", async () => {
			const reservedSluggable = harness.makeSluggable().preventSlugs(["admin"]);
			const limitedSluggable = harness
				.makeSluggable()
				.slugsShouldBeNoLongerThan(12);

			const reserved = await reservedSluggable.insert(harness.db, {
				title: "Admin",
				categoryId: 1,
			});
			await harness.insertRow(asPersistedInsert(reserved));

			const firstLimited = await limitedSluggable.insert(harness.db, {
				title: "This is a very long title",
				categoryId: 1,
			});
			await harness.insertRow(asPersistedInsert(firstLimited));

			const secondLimited = await limitedSluggable.insert(harness.db, {
				title: "This is a very long title",
				categoryId: 1,
			});

			expect(reserved.slug).toBe("admin-2");
			expect(firstLimited.slug?.length).toBeLessThanOrEqual(12);
			expect(secondLimited.slug?.length).toBeLessThanOrEqual(12);
			expect(secondLimited.slug).toMatch(/-2$/);
		});

		it("supports custom slugify functions", async () => {
			const sluggable = harness
				.makeSluggable()
				.usingSlugify((input, separator) => {
					const normalized = input
						.trim()
						.toLowerCase()
						.replace(/\s+/g, separator);
					return `custom-${normalized}`;
				});

			const values = await sluggable.insert(harness.db, {
				title: "Hello Drizzle",
				categoryId: 1,
			});

			expect(values.slug).toBe("custom-hello-drizzle");
		});
	});
}

export function asPersistedInsert(values: InsertRow): Required<InsertRow> {
	if (!values.slug) {
		throw new Error("Expected sluggable insert to produce a slug");
	}

	return {
		title: values.title,
		slug: values.slug,
		categoryId: values.categoryId,
	};
}

export function mapSelectRow(
	row:
		| {
				id: number | bigint;
				title: string;
				slug: string;
				category_id: number | bigint;
		  }
		| Record<string, unknown>,
): SelectRow {
	return {
		id: Number(row.id),
		title: String(row.title),
		slug: String(row.slug),
		categoryId: Number(row.category_id),
	};
}

export function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
