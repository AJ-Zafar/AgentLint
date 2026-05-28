import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@agentspec/spec": new URL("./packages/spec/src/index.ts", import.meta.url).pathname,
      "@agentspec/parser": new URL("./packages/parser/src/index.ts", import.meta.url).pathname,
      "@agentspec/linter": new URL("./packages/linter/src/index.ts", import.meta.url).pathname,
      "@agentspec/test-runner": new URL("./packages/test-runner/src/index.ts", import.meta.url).pathname,
      "@agentspec/diff": new URL("./packages/diff/src/index.ts", import.meta.url).pathname,
      "@agentspec/grammar": new URL("./packages/grammar/src/index.ts", import.meta.url).pathname,
      "@agentspec/replay": new URL("./packages/replay/src/index.ts", import.meta.url).pathname,
      "@agentspec/coverage": new URL("./packages/coverage/src/index.ts", import.meta.url).pathname,
      "@agentspec/compiler": new URL("./packages/compiler/src/index.ts", import.meta.url).pathname,
      "@agentspec/copilot-studio": new URL("./packages/copilot-studio/src/index.ts", import.meta.url).pathname,
      "@agentspec/copilot-studio-audit": new URL("./packages/copilot-studio-audit/src/index.ts", import.meta.url).pathname,
      "@agentspec/vscode-extension": new URL("./packages/vscode-extension/src/analysis.ts", import.meta.url).pathname
    }
  },
  test: {
    include: ["packages/**/*.test.ts"],
    coverage: {
      reporter: ["text", "lcov"]
    }
  }
});
