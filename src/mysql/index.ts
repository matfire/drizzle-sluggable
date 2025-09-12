import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyMySqlTable } from "drizzle-orm/mysql-core";
import type { DBLike, SluggableOptions } from "../core";
import { makeSlugBeforeInsertCore, makeSlugBeforeUpdateCore } from "../core";

export type MySqlSluggableOptions<TTable extends AnyMySqlTable> =
	SluggableOptions<InferInsertModel<TTable>, InferSelectModel<TTable>>;

export async function makeSlugBeforeInsert<
	TTable extends AnyMySqlTable,
>(params: {
	db: DBLike;
	table: TTable;
	data: InferInsertModel<TTable>;
	options: MySqlSluggableOptions<TTable>;
}): Promise<InferInsertModel<TTable>> {
	return makeSlugBeforeInsertCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>
	>(params);
}

export async function makeSlugBeforeUpdate<
	TTable extends AnyMySqlTable,
>(params: {
	db: DBLike;
	table: TTable;
	existing: InferSelectModel<TTable>;
	patch: Partial<InferInsertModel<TTable>>;
	options: MySqlSluggableOptions<TTable>;
}): Promise<Partial<InferInsertModel<TTable>>> {
	return makeSlugBeforeUpdateCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>
	>(params);
}
