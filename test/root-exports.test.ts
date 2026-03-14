import { expect, it } from "vitest";
import {
	createMysqlSluggable,
	createPgSluggable,
	createSqliteSluggable,
	defaultSlugify,
} from "../src";

it("exposes root named exports for each provider", () => {
	expect(typeof createPgSluggable).toBe("function");
	expect(typeof createMysqlSluggable).toBe("function");
	expect(typeof createSqliteSluggable).toBe("function");
	expect(defaultSlugify("Hello Root Export")).toBe("hello-root-export");
});
