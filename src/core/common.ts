/** biome-ignore-all lint/suspicious/noExplicitAny: Will be more detailed in each specific implementation */
/** biome-ignore-all lint/complexity/noBannedTypes: Will be more detailed in each specific implementation */
import { type SQL, sql } from "drizzle-orm";

export type DBLike = {
	select: Function;
	insert?: Function;
	update?: Function;
	delete?: Function;
};

export type SluggableOptions<InsertModel, SelectModel> = {
	source: (keyof InsertModel)[] | ((data: Partial<InsertModel>) => string);
	slugField: keyof InsertModel;
	scope?: Partial<InsertModel>;
	separator?: string;
	maxLength?: number;
	onUpdate?: "never" | "updateIfSourceChanged" | "always";
	reserved?: string[];
	slugify?: (input: string, separator: string) => string;
	customUniqueResolver?: (params: {
		baseSlug: string;
		separator: string;
		maxLength?: number;
		existingSlugs: string[];
	}) => string;
	idField?: keyof SelectModel;
};

export function buildBaseString<InsertModel>(
	data: Partial<InsertModel>,
	source: (keyof InsertModel)[] | ((data: Partial<InsertModel>) => string),
): string {
	if (typeof source === "function") return source(data);
	return source
		.map((k) => (data[k] as unknown as string) ?? "")
		.filter(Boolean)
		.join(" ");
}

export function truncateWithSuffix(
	base: string,
	suffix: string,
	maxLength?: number,
): string {
	if (!maxLength) return base + suffix;
	const room = Math.max(0, maxLength - suffix.length);
	const truncatedBase = room > 0 ? base.slice(0, room) : "";
	return truncatedBase + suffix;
}

export async function fetchExistingSlugs({
	db,
	table,
	slugColumn,
	baseSlug,
	separator,
	scope,
	excludeId,
	idColumn,
}: {
	db: DBLike;
	table: any;
	slugColumn: any; // a reference to table[slugField]
	baseSlug: string;
	separator: string;
	scope?: Record<string, unknown>;
	excludeId?: unknown;
	idColumn?: any; // a reference to table[idField]
}): Promise<string[]> {
	const likePattern = `${baseSlug}${separator}%`;

	const conditions: SQL[] = [
		sql`${slugColumn} = ${baseSlug}`,
		sql`${slugColumn} LIKE ${likePattern}`,
	];
	const whereClauses: SQL[] = [sql`(${sql.join(conditions, sql` OR `)})`];

	if (scope && Object.keys(scope).length > 0) {
		for (const [col, val] of Object.entries(scope)) {
			whereClauses.push(sql`${(table as any)[col]} = ${val as any}`);
		}
	}

	if (excludeId != null && idColumn) {
		whereClauses.push(sql`${idColumn} <> ${excludeId as any}`);
	}

	const rows = await (db as any)
		.select({ slug: slugColumn })
		.from(table)
		.where(sql.join(whereClauses, sql` AND `));

	return rows.map((r: any) => r.slug as string);
}

export function defaultUniqueResolver(params: {
	baseSlug: string;
	separator: string;
	maxLength?: number;
	existingSlugs: string[];
}): string {
	const { baseSlug, separator, maxLength, existingSlugs } = params;

	if (!existingSlugs.includes(baseSlug)) {
		return maxLength ? baseSlug.slice(0, maxLength) : baseSlug;
	}

	const taken = new Set(existingSlugs);
	let counter = 2;
	while (true) {
		const candidate = truncateWithSuffix(
			baseSlug,
			`${separator}${counter}`,
			maxLength,
		);
		if (!taken.has(candidate)) return candidate;
		counter++;
	}
}
