import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import type {
	CreateSluggableConfig,
	ResolveFromState,
	ResolveIdState,
	ResolveToState,
	SluggableBuilderApi,
} from "../core";
import { createSluggableCore } from "../core";

export type SluggableConfig<TTable extends AnyPgTable> = CreateSluggableConfig<
	InferInsertModel<TTable>,
	InferSelectModel<TTable>
>;

export type Sluggable<
	TTable extends AnyPgTable,
	Config extends SluggableConfig<TTable> | undefined = undefined,
> = SluggableBuilderApi<
	InferInsertModel<TTable>,
	InferSelectModel<TTable>,
	TTable,
	ResolveFromState<InferInsertModel<TTable>, InferSelectModel<TTable>, Config>,
	ResolveToState<InferInsertModel<TTable>, Config>,
	ResolveIdState<InferSelectModel<TTable>, Config>
>;

export function createSluggable<
	TTable extends AnyPgTable,
	Config extends SluggableConfig<TTable> | undefined,
>(table: TTable, config?: Config): Sluggable<TTable, Config> {
	return createSluggableCore<
		InferInsertModel<TTable>,
		InferSelectModel<TTable>,
		TTable,
		Config
	>(table, config);
}
