import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import type { CreateSluggableConfig } from "../core";
import { createSluggableCore } from "../core";

export type SluggableConfig<TTable extends AnySQLiteTable> =
	CreateSluggableConfig<InferInsertModel<TTable>, InferSelectModel<TTable>>;

export type Sluggable<TTable extends AnySQLiteTable> = ReturnType<
	typeof createSluggableCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>,
		TTable
	>
>;

export function createSluggable<TTable extends AnySQLiteTable>(
	table: TTable,
	config?: SluggableConfig<TTable>,
): Sluggable<TTable> {
	return createSluggableCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>,
		TTable
	>(table, config);
}
