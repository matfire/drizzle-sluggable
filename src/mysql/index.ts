import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyMySqlTable } from "drizzle-orm/mysql-core";
import type { CreateSluggableConfig } from "../core";
import { createSluggableCore } from "../core";

export type SluggableConfig<TTable extends AnyMySqlTable> =
	CreateSluggableConfig<InferInsertModel<TTable>, InferSelectModel<TTable>>;

export type Sluggable<TTable extends AnyMySqlTable> = ReturnType<
	typeof createSluggableCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>,
		TTable
	>
>;

export function createSluggable<TTable extends AnyMySqlTable>(
	table: TTable,
	config?: SluggableConfig<TTable>,
): Sluggable<TTable> {
	return createSluggableCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>,
		TTable
	>(table, config);
}
