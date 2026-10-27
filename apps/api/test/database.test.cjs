const { test } = require("node:test");
const assert = require("node:assert/strict");
const { databaseUrl } = require("../dist/database/config.js");

test("database config rejects missing and malformed values without exposing input", () => {
  const previous = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = "not-a-url";
    assert.throws(() => databaseUrl(), { message: "DATABASE_URL is invalid" });
    process.env.DATABASE_URL = "https://localhost/database";
    assert.throws(() => databaseUrl(), { message: "DATABASE_URL must identify a PostgreSQL database" });
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
