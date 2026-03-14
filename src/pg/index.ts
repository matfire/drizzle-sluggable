import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import type { CreateSluggableConfig } from "../core";
import { createSluggableCore } from "../core";

export type SluggableConfig<TTable extends AnyPgTable> = CreateSluggableConfig<
	InferInsertModel<TTable>,
	InferSelectModel<TTable>
>;

export type Sluggable<TTable extends AnyPgTable> = ReturnType<
	typeof createSluggableCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>,
		TTable
	>
>;

export function createSluggable<TTable extends AnyPgTable>(
	table: TTable,
	config?: SluggableConfig<TTable>,
): Sluggable<TTable> {
	return createSluggableCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>,
		TTable
	>(table, config);
}
