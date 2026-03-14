import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/pg/index.ts", "src/mysql/index.ts", "src/sqlite/index.ts"],
	format: "esm",
	dts: true,
	clean: true,
	sourcemap: true,
	outDir: "./dist",
});
