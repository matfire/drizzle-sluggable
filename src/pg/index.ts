import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import type { DBLike, SluggableOptions } from "../core";
import { makeSlugBeforeInsertCore, makeSlugBeforeUpdateCore } from "../core";

export type PgSluggableOptions<TTable extends AnyPgTable> = SluggableOptions<
	InferInsertModel<TTable>,
	InferSelectModel<TTable>
>;

export async function makeSlugBeforeInsert<TTable extends AnyPgTable>(params: {
	db: DBLike;
	table: TTable;
	data: InferInsertModel<TTable>;
	options: PgSluggableOptions<TTable>;
}): Promise<InferInsertModel<TTable>> {
	return makeSlugBeforeInsertCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>
	>(params);
}

export async function makeSlugBeforeUpdate<TTable extends AnyPgTable>(params: {
	db: DBLike;
	table: TTable;
	existing: InferSelectModel<TTable>;
	patch: Partial<InferInsertModel<TTable>>;
	options: PgSluggableOptions<TTable>;
}): Promise<Partial<InferInsertModel<TTable>>> {
	return makeSlugBeforeUpdateCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>
	>(params);
}
