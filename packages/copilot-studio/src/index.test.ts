import { describe, expect, it } from "vitest";
import { parseAgentSpecFile } from "@agentspec/parser";
import { convertAgentSpecToCopilotStudioPlan } from "./index";

const examplePath = "examples/copilot-studio-agent.agentspec.yaml";

describe("Copilot Studio plan conversion", () => {
  it("converts AgentSpec concepts into a markdown implementation plan", async () => {
    const parsed = await parseAgentSpecFile(examplePath);
    const markdown = convertAgentSpecToCopilotStudioPlan(parsed.document);

    expect(markdown).toContain("# Copilot Studio Implementation Plan: Copilot Studio Readiness Agent");
    expect(markdown).toContain("## Topics");
    expect(markdown).toContain("### deployment_readiness");
    expect(markdown).toContain("Triggers: publish, deployment, readiness, environment");
    expect(markdown).toContain("## Actions");
    expect(markdown).toContain("inspect_agent_config");
    expect(markdown).toContain("Allowed operations: read_topics, read_connectors, read_environment_policy, read_publish_status");
    expect(markdown).toContain("## Knowledge Sources");
    expect(markdown).toContain("organization publishing and data-loss-prevention policy");
    expect(markdown).toContain("## Handoff Rules");
    expect(markdown).toContain("maker_admin_review");
    expect(markdown).toContain("## Authentication Assumptions");
    expect(markdown).toContain("inspect_agent_config requires authenticated access");
    expect(markdown).toContain("## Power Automate Flows");
    expect(markdown).toContain("read_publish_status");
  });

  it("marks the output as experimental and avoids export/API claims", async () => {
    const parsed = await parseAgentSpecFile(examplePath);
    const markdown = convertAgentSpecToCopilotStudioPlan(parsed.document);

    expect(markdown).toContain("Experimental planning output only");
    expect(markdown).toContain("No Microsoft APIs are called");
    expect(markdown).toContain("does not generate a Copilot Studio export package");
  });
});
