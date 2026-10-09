import assert from "node:assert/strict";
import { test } from "node:test";
import { assertRequestedLevelSupported, validateAliases, type Alias } from "./index.ts";

const base = { id: "a", target: "p/m", contextWindow: 1000, maxTokens: 100 };
const validate = (aliases: unknown[]) => validateAliases({ aliases }, "cfg");

test("accepts a valid alias", () => assert.equal(validate([base]).length, 1));

test("rejects invalid configs", () => {
  assert.throws(() => validateAliases({}, "cfg"), /must be an array/);
  assert.throws(() => validate([{ ...base, target: "nomodel" }]), /provider\/model/);
  assert.throws(() => validate([base, base]), /duplicate/);
  assert.throws(() => validate([{ ...base, target: "modealias/b" }]), /another alias/);
  assert.throws(() => validate([{ ...base, contextWindow: undefined }]), /contextWindow/);
  assert.throws(() => validate([{ ...base, maxTokens: 0 }]), /maxTokens/);
});

const alias: Alias = { ...base, reasoning: true, thinkingLevelMap: { xhigh: null } };
const byId = new Map([[alias.id, alias]]);
const check = (...argv: string[]) => assertRequestedLevelSupported(byId, ["node", "pi", ...argv]);

test("CLI thinking level check", () => {
  check();
  check("--model", "modealias/a:high");
  check("--model", "other/x", "--thinking", "xhigh");
  assert.throws(() => check("--model", "modealias/a:xhigh"), /does not support/);
  assert.throws(() => check("--model", "a", "--thinking", "xhigh"), /does not support/);
});
