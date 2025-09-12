/** biome-ignore-all lint/suspicious/noExplicitAny:  Will be more detailed in each specific implementation */
import {
	buildBaseString,
	type DBLike,
	defaultUniqueResolver,
	fetchExistingSlugs,
} from "./common";
import { defaultSlugify } from "./slugify";

export type { DBLike, SluggableOptions } from "./common";

export async function makeSlugBeforeInsertCore<
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
	options: import("./common").SluggableOptions<InsertModel, SelectModel>;
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
		: buildBaseString<InsertModel>(data, source);

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
		scope: scope as any,
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

export async function makeSlugBeforeUpdateCore<
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
	options: import("./common").SluggableOptions<InsertModel, SelectModel>;
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
			: (source as (keyof InsertModel)[])
					.map((k) => ((existing as any)[k] ?? "") as string)
					.filter(Boolean)
					.join(" ");

	const afterStr =
		typeof source === "function"
			? source({ ...(existing as any), ...(patch as any) })
			: (source as (keyof InsertModel)[])
					.map(
						(k) => ((patch as any)[k] ?? (existing as any)[k] ?? "") as string,
					)
					.filter(Boolean)
					.join(" ");

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
		scope: scope as any,
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
		const c = truncate(candidate, `${separator}${counter}`, maxLength);
		if (!reserved.includes(c)) return c;
		counter++;
	}
}

function truncate(base: string, suffix: string, maxLength?: number): string {
	if (!maxLength) return base + suffix;
	const room = Math.max(0, maxLength - suffix.length);
	const truncatedBase = room > 0 ? base.slice(0, room) : "";
	return truncatedBase + suffix;
}
