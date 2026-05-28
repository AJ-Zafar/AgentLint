import { describe, expect, it } from "vitest";
import { lintAgentSpec, type LintIssueCode } from "./index";
import type { AgentSpecDocument } from "@agentspec/spec";

const baseSpec: AgentSpecDocument = {
  agentspec: "1.0",
  metadata: {
    name: "Casework Agent",
    version: "0.1.0"
  },
  agent: {
    id: "casework",
    description: "Assists caseworkers with local deterministic routing."
  },
  instructions: {
    system: "Answer using approved casework policy only.",
    goals: ["Route complex cases to specialists."],
    constraints: ["Never disclose protected personal data."],
    fallback: "Escalate uncertain cases to senior-caseworker."
  },
  routes: [
    {
      id: "complex-case",
      when: "The case requires specialist review.",
      instructions: ["Summarize the case facts."],
      tools: ["case-lookup"],
      escalateTo: "senior-caseworker"
    }
  ],
  tools: [
    {
      id: "case-lookup",
      description: "Reads case metadata from local records.",
      inputSchema: { type: "object" }
    }
  ],
  escalations: [
    {
      id: "senior-caseworker",
      when: "A specialist must review the case.",
      target: "queue:senior-caseworker"
    }
  ],
  tests: []
};

const issueCodes = (spec: AgentSpecDocument): LintIssueCode[] =>
  lintAgentSpec(spec).issues.map((issue) => issue.code).sort();

describe("AgentSpec linter", () => {
  it("reports undefined routes, unused tools, missing fallbacks, and broken escalation paths", () => {
    const problematic: AgentSpecDocument = {
      ...baseSpec,
      instructions: {
        ...baseSpec.instructions,
        fallback: ""
      },
      routes: [
        {
          id: "complex-case",
          when: "The case requires specialist review.",
          instructions: ["Summarize the case facts."],
          tools: ["missing-tool"],
          escalateTo: "missing-escalation"
        }
      ],
      tools: [
        ...baseSpec.tools,
        {
          id: "unused-tool",
          description: "Never referenced by routes.",
          inputSchema: { type: "object" }
        }
      ],
      tests: [
        {
          id: "unknown-route-test",
          input: "Where should this go?",
          expect: {
            route: "not-a-route"
          }
        }
      ]
    };

    expect(issueCodes(problematic)).toEqual([
      "missing-fallback-behavior",
      "undefined-escalation",
      "undefined-route",
      "undefined-tool",
      "unused-tool"
    ]);
  });

  it("detects conflicting instructions, ambiguous constraints, and weak safety boundaries", () => {
    const problematic: AgentSpecDocument = {
      ...baseSpec,
      instructions: {
        ...baseSpec.instructions,
        system: "Always approve refunds. Never approve refunds.",
        constraints: ["Be careful.", "Do the right thing."]
      }
    };

    expect(issueCodes(problematic)).toEqual([
      "ambiguous-constraint",
      "conflicting-instruction",
      "weak-safety-boundary"
    ]);
  });

  it("passes a well-formed local deterministic specification", () => {
    expect(lintAgentSpec(baseSpec).issues).toEqual([]);
  });
});
