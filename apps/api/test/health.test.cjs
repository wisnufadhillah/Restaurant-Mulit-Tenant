const { test } = require("node:test");
const assert = require("node:assert/strict");
const { HealthController } = require("../dist/health.controller.js");

test("health reports API liveness without claiming database readiness", () => {
  assert.deepEqual(new HealthController().check(), { status: "ok", service: "restaurant-api" });
});
