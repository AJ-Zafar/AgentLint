import { defineConfig } from "vitepress";

export default defineConfig({
  title: "AgentSpec",
  description: "An open-source specification, linter and test framework for AI agent instructions.",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: undefined,
    nav: [
      { text: "Guide", link: "/" },
      { text: "Reference", link: "/reference/yaml" },
      { text: "GitHub", link: "https://github.com/AJ-Zafar/AgentLint" }
    ],
    sidebar: [
      {
        text: "Getting started",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Why AgentSpec exists", link: "/why" },
          { text: "Quickstart", link: "/quickstart" }
        ]
      },
      {
        text: "Reference",
        items: [
          { text: "AgentSpec YAML reference", link: "/reference/yaml" },
          { text: "CLI reference", link: "/reference/cli" },
          { text: "Linter rules", link: "/reference/linter-rules" }
        ]
      },
      {
        text: "Workflows",
        items: [
          { text: "Examples gallery", link: "/guide/examples" },
          { text: "Testing agent behaviour", link: "/guide/testing" },
          { text: "Behaviour graph generation", link: "/guide/behaviour-graph" },
          { text: "Diff and regression analysis", link: "/guide/diff" },
          { text: "CI governance gates", link: "/guide/ci-governance" },
          { text: "Copilot Studio mapping", link: "/integrations/copilot-studio" }
        ]
      },
      {
        text: "Project",
        items: [
          { text: "Roadmap", link: "/roadmap" },
          { text: "Contributing", link: "/contributing" }
        ]
      }
    ],
    search: {
      provider: "local"
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/AJ-Zafar/AgentLint" }
    ],
    footer: {
      message: "Released as open-source infrastructure for AI instruction engineering.",
      copyright: "AgentSpec contributors"
    }
  }
});
