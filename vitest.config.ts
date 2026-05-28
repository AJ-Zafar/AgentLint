import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@agentspec/spec": new URL("./packages/spec/src/index.ts", import.meta.url).pathname,
      "@agentspec/parser": new URL("./packages/parser/src/index.ts", import.meta.url).pathname,
      "@agentspec/linter": new URL("./packages/linter/src/index.ts", import.meta.url).pathname,
      "@agentspec/test-runner": new URL("./packages/test-runner/src/index.ts", import.meta.url).pathname,
      "@agentspec/diff": new URL("./packages/diff/src/index.ts", import.meta.url).pathname
    }
  },
  test: {
    include: ["packages/**/*.test.ts"],
    coverage: {
      reporter: ["text", "lcov"]
    }
  }
});
