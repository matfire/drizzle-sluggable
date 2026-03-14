/** biome-ignore-all lint/suspicious/noExplicitAny: Generic Drizzle helpers need loose internals */
import {
	buildBaseString,
	type DBLike,
	defaultUniqueResolver,
	fetchExistingSlugs,
	hasColumn,
	resolveScope,
	type SluggableOptions,
	type SluggableScope,
	type SluggableSource,
} from "./common";
import { defaultSlugify } from "./slugify";

export type CreateSluggableConfig<InsertModel, SelectModel> = {
	from?: SluggableSource<InsertModel, SelectModel>;
	to?: keyof InsertModel;
	scope?: SluggableScope<InsertModel, SelectModel>;
	separator?: string;
	maxLength?: number;
	reserved?: string[];
	slugify?: (input: string, separator: string) => string;
	uniqueResolver?: SluggableOptions<
		InsertModel,
		SelectModel
	>["customUniqueResolver"];
	idField?: keyof SelectModel;
	updateSlugs?: "never" | "whenSourceChanges" | "always";
};

export type HasDefaultSource<InsertModel> = "title" extends keyof InsertModel
	? true
	: "name" extends keyof InsertModel
		? true
		: false;

export type HasDefaultSlugField<InsertModel> = "slug" extends keyof InsertModel
	? true
	: false;

export type HasDefaultIdField<SelectModel> = "id" extends keyof SelectModel
	? true
	: false;

export type ResolveFromState<InsertModel, SelectModel, Config> =
	Config extends {
		from: SluggableSource<InsertModel, SelectModel>;
	}
		? true
		: HasDefaultSource<InsertModel>;

export type ResolveToState<InsertModel, Config> = Config extends {
	to: keyof InsertModel;
}
	? true
	: HasDefaultSlugField<InsertModel>;

export type ResolveIdState<SelectModel, Config> = Config extends {
	idField: keyof SelectModel;
}
	? true
	: HasDefaultIdField<SelectModel>;

type ExistingRowLoader<SelectModel> =
	| SelectModel
	| Promise<SelectModel | null | undefined>
	| (() =>
			| SelectModel
			| null
			| undefined
			| Promise<SelectModel | null | undefined>);

type InsertMethod<
	InsertModel,
	HasFrom extends boolean,
	HasTo extends boolean,
> = HasFrom extends true
	? HasTo extends true
		? (db: DBLike, data: InsertModel) => Promise<InsertModel>
		: never
	: never;

type UpdateMethod<
	InsertModel,
	SelectModel,
	HasFrom extends boolean,
	HasTo extends boolean,
	HasId extends boolean,
> = HasFrom extends true
	? HasTo extends true
		? HasId extends true
			? (
					db: DBLike,
					existing: SelectModel,
					patch: Partial<InsertModel>,
				) => Promise<Partial<InsertModel>>
			: never
		: never
	: never;

type UpdateFromMethod<
	InsertModel,
	SelectModel,
	HasFrom extends boolean,
	HasTo extends boolean,
	HasId extends boolean,
> = HasFrom extends true
	? HasTo extends true
		? HasId extends true
			? (
					db: DBLike,
					existing: ExistingRowLoader<SelectModel>,
					patch: Partial<InsertModel>,
				) => Promise<Partial<InsertModel>>
			: never
		: never
	: never;

export type SluggableBuilderApi<
	InsertModel extends Record<string, any>,
	SelectModel extends Record<string, any>,
	Table,
	HasFrom extends boolean,
	HasTo extends boolean,
	HasId extends boolean,
> = {
	from(
		source: SluggableSource<InsertModel, SelectModel>,
	): SluggableBuilderApi<InsertModel, SelectModel, Table, true, HasTo, HasId>;
	to(
		slugField: keyof InsertModel,
	): SluggableBuilderApi<InsertModel, SelectModel, Table, HasFrom, true, HasId>;
	withinScope(
		scope: SluggableScope<InsertModel, SelectModel>,
	): SluggableBuilderApi<
		InsertModel,
		SelectModel,
		Table,
		HasFrom,
		HasTo,
		HasId
	>;
	usingSeparator(
		separator: string,
	): SluggableBuilderApi<
		InsertModel,
		SelectModel,
		Table,
		HasFrom,
		HasTo,
		HasId
	>;
	slugsShouldBeNoLongerThan(
		maxLength: number,
	): SluggableBuilderApi<
		InsertModel,
		SelectModel,
		Table,
		HasFrom,
		HasTo,
		HasId
	>;
	preventSlugs(
		reserved: string[],
	): SluggableBuilderApi<
		InsertModel,
		SelectModel,
		Table,
		HasFrom,
		HasTo,
		HasId
	>;
	usingSlugify(
		slugify: (input: string, separator: string) => string,
	): SluggableBuilderApi<
		InsertModel,
		SelectModel,
		Table,
		HasFrom,
		HasTo,
		HasId
	>;
	usingUniqueResolver(
		uniqueResolver: SluggableOptions<
			InsertModel,
			SelectModel
		>["customUniqueResolver"],
	): SluggableBuilderApi<
		InsertModel,
		SelectModel,
		Table,
		HasFrom,
		HasTo,
		HasId
	>;
	usingIdField(
		idField: keyof SelectModel,
	): SluggableBuilderApi<InsertModel, SelectModel, Table, HasFrom, HasTo, true>;
	doNotRegenerateOnUpdate(): SluggableBuilderApi<
		InsertModel,
		SelectModel,
		Table,
		HasFrom,
		HasTo,
		HasId
	>;
	regenerateOnEveryUpdate(): SluggableBuilderApi<
		InsertModel,
		SelectModel,
		Table,
		HasFrom,
		HasTo,
		HasId
	>;
	regenerateOnSourceChange(): SluggableBuilderApi<
		InsertModel,
		SelectModel,
		Table,
		HasFrom,
		HasTo,
		HasId
	>;
	insert: InsertMethod<InsertModel, HasFrom, HasTo>;
	update: UpdateMethod<InsertModel, SelectModel, HasFrom, HasTo, HasId>;
	updateFrom: UpdateFromMethod<InsertModel, SelectModel, HasFrom, HasTo, HasId>;
};

type ResolvedBuilderConfig<InsertModel, SelectModel> = {
	from?: SluggableSource<InsertModel, SelectModel>;
	to?: keyof InsertModel;
	scope?: SluggableScope<InsertModel, SelectModel>;
	separator?: string;
	maxLength?: number;
	reserved?: string[];
	slugify?: (input: string, separator: string) => string;
	uniqueResolver?: SluggableOptions<
		InsertModel,
		SelectModel
	>["customUniqueResolver"];
	idField?: keyof SelectModel;
	onUpdate?: SluggableOptions<InsertModel, SelectModel>["onUpdate"];
};

class SluggableBuilder<
	InsertModel extends Record<string, any>,
	SelectModel extends Record<string, any>,
	Table extends object,
	HasFrom extends boolean = false,
	HasTo extends boolean = false,
	HasId extends boolean = false,
> {
	private config: ResolvedBuilderConfig<InsertModel, SelectModel>;

	constructor(
		private readonly table: Table,
		config?: CreateSluggableConfig<InsertModel, SelectModel>,
	) {
		this.config = normalizeBuilderConfig(config);
	}

	from(source: SluggableSource<InsertModel, SelectModel>) {
		this.config.from = source;
		return this as unknown as SluggableBuilder<
			InsertModel,
			SelectModel,
			Table,
			true,
			HasTo,
			HasId
		>;
	}

	to(slugField: keyof InsertModel) {
		this.config.to = slugField;
		return this as unknown as SluggableBuilder<
			InsertModel,
			SelectModel,
			Table,
			HasFrom,
			true,
			HasId
		>;
	}

	withinScope(scope: SluggableScope<InsertModel, SelectModel>) {
		this.config.scope = scope;
		return this;
	}

	usingSeparator(separator: string) {
		this.config.separator = separator;
		return this;
	}

	slugsShouldBeNoLongerThan(maxLength: number) {
		this.config.maxLength = maxLength;
		return this;
	}

	preventSlugs(reserved: string[]) {
		this.config.reserved = reserved;
		return this;
	}

	usingSlugify(slugify: (input: string, separator: string) => string) {
		this.config.slugify = slugify;
		return this;
	}

	usingUniqueResolver(
		uniqueResolver: SluggableOptions<
			InsertModel,
			SelectModel
		>["customUniqueResolver"],
	) {
		this.config.uniqueResolver = uniqueResolver;
		return this;
	}

	usingIdField(idField: keyof SelectModel) {
		this.config.idField = idField;
		return this as unknown as SluggableBuilder<
			InsertModel,
			SelectModel,
			Table,
			HasFrom,
			HasTo,
			true
		>;
	}

	doNotRegenerateOnUpdate() {
		this.config.onUpdate = "never";
		return this;
	}

	regenerateOnEveryUpdate() {
		this.config.onUpdate = "always";
		return this;
	}

	regenerateOnSourceChange() {
		this.config.onUpdate = "updateIfSourceChanged";
		return this;
	}

	async insert(
		this: SluggableBuilder<InsertModel, SelectModel, Table, true, true, HasId>,
		db: DBLike,
		data: InsertModel,
	): Promise<InsertModel> {
		return makeSlugBeforeInsertCore<InsertModel, SelectModel>({
			db,
			table: this.table,
			data,
			options: this.resolveInsertOptions(data),
		});
	}

	async update(
		this: SluggableBuilder<InsertModel, SelectModel, Table, true, true, true>,
		db: DBLike,
		existing: SelectModel,
		patch: Partial<InsertModel>,
	): Promise<Partial<InsertModel>> {
		return makeSlugBeforeUpdateCore<InsertModel, SelectModel>({
			db,
			table: this.table,
			existing,
			patch,
			options: this.resolveUpdateOptions(existing, patch),
		});
	}

	async updateFrom(
		this: SluggableBuilder<InsertModel, SelectModel, Table, true, true, true>,
		db: DBLike,
		existing: ExistingRowLoader<SelectModel>,
		patch: Partial<InsertModel>,
	): Promise<Partial<InsertModel>> {
		const resolvedExisting = await resolveExistingRow(existing);

		return this.update(db, resolvedExisting, patch);
	}

	private resolveInsertOptions(
		data: InsertModel,
	): SluggableOptions<InsertModel, SelectModel> {
		const source = this.config.from ?? inferSource(this.table);
		const slugField = this.config.to ?? inferSlugField(this.table);

		if (!source) {
			throw new Error(
				"Unable to infer the slug source field. Call .from(...) or pass { from: ... }.",
			);
		}

		if (!slugField) {
			throw new Error(
				"Unable to infer the slug destination field. Call .to(...) or pass { to: ... }.",
			);
		}

		return {
			source,
			slugField,
			scope: resolveScope<InsertModel, SelectModel>(
				this.config.scope as
					| SluggableScope<InsertModel, SelectModel>
					| undefined,
				data as Partial<InsertModel> & Partial<SelectModel>,
			) as Record<string, unknown> | undefined,
			separator: this.config.separator,
			maxLength: this.config.maxLength,
			reserved: this.config.reserved,
			slugify: this.config.slugify,
			customUniqueResolver: this.config.uniqueResolver,
		};
	}

	private resolveUpdateOptions(
		existing: SelectModel,
		patch: Partial<InsertModel>,
	): SluggableOptions<InsertModel, SelectModel> {
		const source = this.config.from ?? inferSource(this.table);
		const slugField = this.config.to ?? inferSlugField(this.table);
		const idField = this.config.idField ?? inferIdField(this.table);
		const scopeInput = {
			...(existing as any),
			...(patch as any),
		} as Partial<InsertModel> & Partial<SelectModel>;

		if (!source) {
			throw new Error(
				"Unable to infer the slug source field. Call .from(...) or pass { from: ... }.",
			);
		}

		if (!slugField) {
			throw new Error(
				"Unable to infer the slug destination field. Call .to(...) or pass { to: ... }.",
			);
		}

		if (!idField) {
			throw new Error(
				"Unable to infer the primary key field. Call .usingIdField(...) or pass { idField: ... }.",
			);
		}

		return {
			source,
			slugField,
			scope: resolveScope<InsertModel, SelectModel>(
				this.config.scope as
					| SluggableScope<InsertModel, SelectModel>
					| undefined,
				scopeInput,
			) as Record<string, unknown> | undefined,
			separator: this.config.separator,
			maxLength: this.config.maxLength,
			reserved: this.config.reserved,
			slugify: this.config.slugify,
			customUniqueResolver: this.config.uniqueResolver,
			idField,
			onUpdate: this.config.onUpdate,
		};
	}
}

export function createSluggableCore<
	InsertModel extends Record<string, any>,
	SelectModel extends Record<string, any>,
	Table extends object,
	Config extends CreateSluggableConfig<InsertModel, SelectModel> | undefined,
>(table: Table, config?: Config) {
	return new SluggableBuilder<
		InsertModel,
		SelectModel,
		Table,
		ResolveFromState<InsertModel, SelectModel, Config>,
		ResolveToState<InsertModel, Config>,
		ResolveIdState<SelectModel, Config>
	>(table, config) as unknown as SluggableBuilderApi<
		InsertModel,
		SelectModel,
		Table,
		ResolveFromState<InsertModel, SelectModel, Config>,
		ResolveToState<InsertModel, Config>,
		ResolveIdState<SelectModel, Config>
	>;
}

async function resolveExistingRow<SelectModel>(
	existing: ExistingRowLoader<SelectModel>,
): Promise<SelectModel> {
	const value =
		typeof existing === "function"
			? await (
					existing as () =>
						| SelectModel
						| null
						| undefined
						| Promise<SelectModel | null | undefined>
				)()
			: await existing;

	if (!value) {
		throw new Error(
			"Unable to load the existing row for update. Make sure the row exists before generating a slug patch.",
		);
	}

	return value;
}

async function makeSlugBeforeInsertCore<
	InsertModel extends Record<string, any>,
	SelectModel extends Record<string, any>,
>({
	db,
	table,
	data,
	options,
}: {
	db: DBLike;
	table: any;
	data: InsertModel;
	options: SluggableOptions<InsertModel, SelectModel>;
}): Promise<InsertModel> {
	const {
		source,
		slugField,
		scope,
		separator = "-",
		maxLength,
		reserved,
		slugify = defaultSlugify,
		customUniqueResolver,
	} = options;

	const hasProvidedSlug = Boolean(data[slugField as keyof InsertModel]);
	const rawBase = hasProvidedSlug
		? String(data[slugField as keyof InsertModel] ?? "")
		: buildBaseString<InsertModel>(
				data,
				source as SluggableSource<InsertModel>,
			);

	let base = slugify(rawBase, separator);
	if (!base) base = slugify(`${Date.now()}`, separator);
	if (maxLength) base = base.slice(0, maxLength);

	const slugColumn = table[slugField as string];

	const existing = await fetchExistingSlugs({
		db,
		table,
		slugColumn,
		baseSlug: base,
		separator,
		scope,
	});

	const uniqueSlug = (customUniqueResolver ?? defaultUniqueResolver)({
		baseSlug: base,
		separator,
		maxLength,
		existingSlugs: existing,
	});

	const finalSlug = ensureNotReserved(
		uniqueSlug,
		reserved,
		separator,
		maxLength,
	);

	return {
		...data,
		[slugField as string]: finalSlug,
	} as InsertModel;
}

async function makeSlugBeforeUpdateCore<
	InsertModel extends Record<string, any>,
	SelectModel extends Record<string, any>,
>({
	db,
	table,
	existing,
	patch,
	options,
}: {
	db: DBLike;
	table: any;
	existing: SelectModel;
	patch: Partial<InsertModel>;
	options: SluggableOptions<InsertModel, SelectModel>;
}): Promise<Partial<InsertModel>> {
	const {
		source,
		slugField,
		scope,
		onUpdate = "updateIfSourceChanged",
		separator = "-",
		maxLength,
		reserved,
		slugify = defaultSlugify,
		customUniqueResolver,
		idField = "id" as keyof SelectModel,
	} = options;

	const beforeStr =
		typeof source === "function"
			? source(existing as any)
			: buildBaseString<InsertModel>(
					existing as any,
					source as SluggableSource<InsertModel>,
				);

	const afterStr =
		typeof source === "function"
			? source({ ...(existing as any), ...(patch as any) })
			: buildBaseString<InsertModel>(
					{ ...(existing as any), ...(patch as any) },
					source as SluggableSource<InsertModel>,
				);

	const sourceChanged = beforeStr !== afterStr;

	const shouldRegenerate =
		onUpdate === "always" ||
		(onUpdate === "updateIfSourceChanged" && sourceChanged);

	const incomingSlugProvided =
		patch[slugField as string] != null &&
		String(patch[slugField as string]).trim() !== "";

	if (!shouldRegenerate && !incomingSlugProvided) {
		return patch;
	}

	const rawBase = incomingSlugProvided
		? String(patch[slugField as string] ?? "")
		: afterStr;

	let base = slugify(rawBase, separator);
	if (!base)
		base = slugify(
			`${(existing as any)[idField as string] ?? Date.now()}`,
			separator,
		);
	if (maxLength) base = base.slice(0, maxLength);

	const slugColumn = table[slugField as string];
	const idColumn = table[idField as string];

	const existingSlugs = await fetchExistingSlugs({
		db,
		table,
		slugColumn,
		baseSlug: base,
		separator,
		scope,
		excludeId: (existing as any)[idField as string],
		idColumn,
	});

	const uniqueSlug = (customUniqueResolver ?? defaultUniqueResolver)({
		baseSlug: base,
		separator,
		maxLength,
		existingSlugs,
	});

	const finalSlug = ensureNotReserved(
		uniqueSlug,
		reserved,
		separator,
		maxLength,
	);

	return {
		...patch,
		[slugField as string]: finalSlug,
	};
}

function normalizeBuilderConfig<InsertModel, SelectModel>(
	config?: CreateSluggableConfig<InsertModel, SelectModel>,
): ResolvedBuilderConfig<InsertModel, SelectModel> {
	return {
		from: config?.from,
		to: config?.to,
		scope: config?.scope,
		separator: config?.separator,
		maxLength: config?.maxLength,
		reserved: config?.reserved,
		slugify: config?.slugify,
		uniqueResolver: config?.uniqueResolver,
		idField: config?.idField,
		onUpdate: normalizeUpdateMode(config?.updateSlugs),
	};
}

function normalizeUpdateMode(
	updateSlugs: CreateSluggableConfig<any, any>["updateSlugs"],
): SluggableOptions<any, any>["onUpdate"] | undefined {
	if (!updateSlugs) return undefined;
	if (updateSlugs === "whenSourceChanges") return "updateIfSourceChanged";
	return updateSlugs;
}

function inferSource(table: object): string | undefined {
	if (hasColumn(table, "title")) return "title";
	if (hasColumn(table, "name")) return "name";
	return undefined;
}

function inferSlugField(table: object): string | undefined {
	if (hasColumn(table, "slug")) return "slug";
	return undefined;
}

function inferIdField(table: object): string | undefined {
	if (hasColumn(table, "id")) return "id";
	return undefined;
}

function ensureNotReserved(
	candidate: string,
	reserved: string[] | undefined,
	separator: string,
	maxLength?: number,
): string {
	if (!reserved || reserved.length === 0) return candidate;
	if (!reserved.includes(candidate)) return candidate;

	let counter = 2;
	while (true) {
		const nextCandidate = truncate(
			candidate,
			`${separator}${counter}`,
			maxLength,
		);
		if (!reserved.includes(nextCandidate)) return nextCandidate;
		counter++;
	}
}

function truncate(base: string, suffix: string, maxLength?: number): string {
	if (!maxLength) return base + suffix;
	const room = Math.max(0, maxLength - suffix.length);
	const truncatedBase = room > 0 ? base.slice(0, room) : "";
	return truncatedBase + suffix;
}
