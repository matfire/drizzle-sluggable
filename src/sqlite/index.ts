import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import type { DBLike, SluggableOptions } from "../core";
import { makeSlugBeforeInsertCore, makeSlugBeforeUpdateCore } from "../core";

export type SQLiteSluggableOptions<TTable extends AnySQLiteTable> =
	SluggableOptions<InferInsertModel<TTable>, InferSelectModel<TTable>>;

export async function makeSlugBeforeInsert<
	TTable extends AnySQLiteTable,
>(params: {
	db: DBLike;
	table: TTable;
	data: InferInsertModel<TTable>;
	options: SQLiteSluggableOptions<TTable>;
}): Promise<InferInsertModel<TTable>> {
	return makeSlugBeforeInsertCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>
	>(params);
}

export async function makeSlugBeforeUpdate<
	TTable extends AnySQLiteTable,
>(params: {
	db: DBLike;
	table: TTable;
	existing: InferSelectModel<TTable>;
	patch: Partial<InferInsertModel<TTable>>;
	options: SQLiteSluggableOptions<TTable>;
}): Promise<Partial<InferInsertModel<TTable>>> {
	return makeSlugBeforeUpdateCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>
	>(params);
}
