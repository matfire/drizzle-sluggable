import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import type {
  CreateSluggableConfig,
  ResolveFromState,
  ResolveIdState,
  ResolveToState,
  SluggableBuilderApi,
} from "../core";
import { createSluggableCore } from "../core";

export type SluggableConfig<TTable extends AnySQLiteTable> = CreateSluggableConfig<
  InferInsertModel<TTable>,
  InferSelectModel<TTable>
>;

export type Sluggable<
  TTable extends AnySQLiteTable,
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
  TTable extends AnySQLiteTable,
  Config extends SluggableConfig<TTable> | undefined = undefined,
>(table: TTable, config?: Config): Sluggable<TTable, Config> {
  return createSluggableCore<InferInsertModel<TTable>, InferSelectModel<TTable>, TTable, Config>(
    table,
    config,
  );
}
