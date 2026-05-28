import { describe, expect, it } from "vitest";
import { parseAgentSpecFile } from "@agentspec/parser";
import { runAgentSpecTests } from "./index";

const fixturePath = "packages/test-runner/fixtures/runner.agentspec.yaml";

describe("deterministic AgentSpec test runner", () => {
  it("matches inputs against route triggers and infers route, handoff, and tools", async () => {
    const parsed = await parseAgentSpecFile(fixturePath);
    const result = runAgentSpecTests(parsed.document);

    const billing = result.tests.find((test) => test.name === "billing scenario passes");
    const security = result.tests.find((test) => test.name === "security handoff passes");

    expect(billing).toMatchObject({
      passed: true,
      actual: {
        route: "billing_support",
        toolCalls: ["account_lookup"]
      }
    });
    expect(security).toMatchObject({
      passed: true,
      actual: {
        route: "security_review",
        handoff: "security_handoff",
        toolCalls: ["security_audit"]
      }
    });
  });

  it("reports failed tests with reasons and expected vs actual values", async () => {
    const parsed = await parseAgentSpecFile(fixturePath);
    const result = runAgentSpecTests(parsed.document);
    const failed = result.tests.find((test) => test.name === "intentionally fails expected details");

    expect(failed?.passed).toBe(false);
    expect(failed?.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: "route-mismatch", expected: "security_review", actual: "billing_support" }),
        expect.objectContaining({ reason: "handoff-mismatch", expected: "security_handoff", actual: undefined }),
        expect.objectContaining({ reason: "missing-expected-tool-call", expected: "security_audit", actual: ["account_lookup"] }),
        expect.objectContaining({ reason: "forbidden-tool-called", expected: "not account_lookup", actual: ["account_lookup"] })
      ])
    );
  });

  it("evaluates simple assertions deterministically", async () => {
    const parsed = await parseAgentSpecFile(fixturePath);
    const result = runAgentSpecTests(parsed.document);
    const failed = result.tests.find((test) => test.name === "intentionally fails expected details");

    expect(failed?.assertionResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assertion: "route is security_review", passed: false, expected: "security_review", actual: "billing_support" }),
        expect.objectContaining({ assertion: "calls tool security_audit", passed: false, expected: "security_audit", actual: ["account_lookup"] }),
        expect.objectContaining({ assertion: "input contains suspicious", passed: false, expected: "suspicious" })
      ])
    );
  });

  it("returns a summary score", async () => {
    const parsed = await parseAgentSpecFile(fixturePath);
    const result = runAgentSpecTests(parsed.document);

    expect(result.summary).toEqual({ total: 3, passed: 2, failed: 1, score: 67 });
  });
});
