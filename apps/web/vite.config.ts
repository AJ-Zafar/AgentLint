import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "/AgentLint/",
  resolve: {
    alias: {
      "@agentspec/spec": path.resolve(__dirname, "../../packages/spec/src/index.ts"),
      "@agentspec/parser": path.resolve(__dirname, "../../packages/parser/src/index.ts"),
      "@agentspec/linter": path.resolve(__dirname, "../../packages/linter/src/index.ts"),
      "@agentspec/test-runner": path.resolve(__dirname, "../../packages/test-runner/src/index.ts"),
      "@agentspec/diff": path.resolve(__dirname, "../../packages/diff/src/index.ts"),
      "@agentspec/grammar": path.resolve(__dirname, "../../packages/grammar/src/index.ts"),
      "@agentspec/compiler": path.resolve(__dirname, "../../packages/compiler/src/index.ts"),
      "@agentspec/replay": path.resolve(__dirname, "../../packages/replay/src/index.ts"),
      "@agentspec/coverage": path.resolve(__dirname, "../../packages/coverage/src/index.ts"),
      "@agentspec/report": path.resolve(__dirname, "../../packages/report/src/index.ts"),
    },
  },
  build: {
    rollupOptions: {
      external: ["node:fs/promises", "node:path"],
    },
  },
  optimizeDeps: {
    exclude: ["node:fs/promises", "node:path"],
  },
});
