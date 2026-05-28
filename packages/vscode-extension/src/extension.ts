import * as path from "node:path";
import * as vscode from "vscode";
import { LanguageClient, TransportKind, type LanguageClientOptions, type ServerOptions } from "vscode-languageclient/node.js";
import { parseAgentSpecFile } from "@agentspec/parser";
import { compileAgentSpecGraph } from "@agentspec/grammar";
import { runAgentSpecTests } from "@agentspec/test-runner";
import { diffAgentSpecs } from "@agentspec/diff";

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: { execArgv: ["--nolazy", "--inspect=6009"] } }
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: "agentspec", scheme: "file" }, { pattern: "**/*.agentspec.y?(a)ml" }]
  };

  client = new LanguageClient("agentlintLanguageServer", "Agent Lint Language Server", serverOptions, clientOptions);
  context.subscriptions.push(client);
  void client.start();

  context.subscriptions.push(
    vscode.commands.registerCommand("agentspec.validateCurrentFile", validateCurrentFile),
    vscode.commands.registerCommand("agentspec.lintCurrentFile", lintCurrentFile),
    vscode.commands.registerCommand("agentspec.previewGraph", previewGraph),
    vscode.commands.registerCommand("agentspec.runTests", runTests),
    vscode.commands.registerCommand("agentspec.compareDiff", compareDiff)
  );
}

export async function deactivate(): Promise<void> {
  await client?.stop();
}

async function validateCurrentFile(): Promise<void> {
  const document = activeAgentSpecDocument();
  if (!document) return;
  try {
    await parseAgentSpecFile(document.uri.fsPath);
    vscode.window.showInformationMessage("Agent Lint validation passed.");
  } catch (error) {
    vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
  }
}

async function lintCurrentFile(): Promise<void> {
  const document = activeAgentSpecDocument();
  if (!document) return;
  await document.save();
  vscode.commands.executeCommand("workbench.actions.view.problems");
  vscode.window.showInformationMessage("Agent Lint diagnostics are provided by the language server.");
}

async function previewGraph(): Promise<void> {
  const document = activeAgentSpecDocument();
  if (!document) return;
  const parsed = await parseAgentSpecFile(document.uri.fsPath);
  const result = compileAgentSpecGraph(parsed.document);
  const panel = vscode.window.createWebviewPanel("agentlintGraph", "Agent Lint Graph Preview", vscode.ViewColumn.Beside, {});
  panel.webview.html = graphHtml(result.graph.nodes.length, result.graph.edges.length, JSON.stringify(result.graph, null, 2));
}

async function runTests(): Promise<void> {
  const document = activeAgentSpecDocument();
  if (!document) return;
  const parsed = await parseAgentSpecFile(document.uri.fsPath);
  const result = runAgentSpecTests(parsed.document);
  const channel = vscode.window.createOutputChannel("Agent Lint Tests");
  channel.appendLine(`Passed ${result.summary.passed}/${result.summary.total}, score ${result.summary.score}%`);
  for (const test of result.tests) channel.appendLine(`${test.passed ? "PASS" : "FAIL"} ${test.name}`);
  channel.show();
}

async function compareDiff(): Promise<void> {
  const current = activeAgentSpecDocument();
  if (!current) return;
  const other = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { "Agent Lint specs": ["yaml", "yml"] } });
  if (!other?.[0]) return;
  const [oldSpec, newSpec] = await Promise.all([parseAgentSpecFile(other[0].fsPath), parseAgentSpecFile(current.uri.fsPath)]);
  const diff = diffAgentSpecs(oldSpec.document, newSpec.document);
  const channel = vscode.window.createOutputChannel("Agent Lint Diff");
  channel.appendLine(`Impact: ${diff.impact}`);
  channel.appendLine(`Changes: ${diff.summary.total}`);
  for (const change of diff.changes) channel.appendLine(`${change.impact} ${change.type} ${change.path}`);
  channel.show();
}

function activeAgentSpecDocument(): vscode.TextDocument | undefined {
  const document = vscode.window.activeTextEditor?.document;
  if (!document || !(document.languageId === "agentspec" || /\.agentspec\.ya?ml$/i.test(document.fileName))) {
    vscode.window.showWarningMessage("Open a .agentspec.yaml file first.");
    return undefined;
  }
  return document;
}

function graphHtml(nodes: number, edges: number, graphJson: string): string {
  return `<!doctype html><html><body><h1>Agent Lint Graph Preview</h1><p>${nodes} nodes, ${edges} edges</p><pre>${escapeHtml(graphJson)}</pre></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
