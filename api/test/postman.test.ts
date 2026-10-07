// Keeps the Postman collection (postman/) in step with the routes. Needs no
// database: it only reads the route table.
import { expect, test } from "bun:test";

process.env.DATABASE_URL ||= "postgres://unused@localhost/unused"; // the client connects lazily

const { default: app } = await import("../src/app.ts");
const { COLLECTION_FILE, ENVIRONMENT_FILE, apiRoutes, buildCollection, buildEnvironment, coverage, toJson } = await import(
  "../postman/build.ts"
);

test("every route has a Postman request, and every request has a route", () => {
  expect(coverage(apiRoutes(app))).toEqual({ missing: [], unknown: [] });
});

test("the committed collection is up to date (run `bun run postman`)", async () => {
  expect(await Bun.file(COLLECTION_FILE).text()).toBe(toJson(buildCollection()));
  expect(await Bun.file(ENVIRONMENT_FILE).text()).toBe(toJson(buildEnvironment()));
});
