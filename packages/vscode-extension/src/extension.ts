import * as vscode from "vscode";
import { analyzeAgentSpecText, type AgentSpecAnalysis, type ExtensionDiagnostic } from "./analysis.js";

const diagnosticCollectionName = "agentspec";

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(diagnosticCollectionName);
  context.subscriptions.push(diagnostics);

  const refreshDocument = (document: vscode.TextDocument): void => {
    if (!isAgentSpecDocument(document)) {
      return;
    }

    diagnostics.set(document.uri, diagnosticsForDocument(document));
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(refreshDocument),
    vscode.workspace.onDidSaveTextDocument(refreshDocument),
    vscode.workspace.onDidChangeTextDocument((event) => refreshDocument(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
    vscode.commands.registerCommand("agentspec.validateCurrentFile", () => validateCurrentFile(diagnostics)),
    vscode.commands.registerCommand("agentspec.lintCurrentFile", () => lintCurrentFile(diagnostics))
  );

  for (const document of vscode.workspace.textDocuments) {
    refreshDocument(document);
  }
}

export function deactivate(): void {
  // Nothing to dispose; subscriptions are owned by VS Code extension context.
}

async function validateCurrentFile(diagnostics: vscode.DiagnosticCollection): Promise<void> {
  const document = getActiveAgentSpecDocument();
  if (!document) {
    vscode.window.showWarningMessage("Open a .agentspec.yaml file to validate.");
    return;
  }

  const analysis = analyzeDocument(document);
  diagnostics.set(document.uri, mapDiagnostics(document, analysis.diagnostics));

  if (analysis.validationDiagnostics.length === 0) {
    vscode.window.showInformationMessage("AgentSpec validation passed.");
    return;
  }

  vscode.window.showErrorMessage(`AgentSpec validation found ${analysis.validationDiagnostics.length} issue(s).`);
}

async function lintCurrentFile(diagnostics: vscode.DiagnosticCollection): Promise<void> {
  const document = getActiveAgentSpecDocument();
  if (!document) {
    vscode.window.showWarningMessage("Open a .agentspec.yaml file to lint.");
    return;
  }

  const analysis = analyzeDocument(document);
  diagnostics.set(document.uri, mapDiagnostics(document, analysis.diagnostics));

  if (!analysis.valid) {
    vscode.window.showErrorMessage("AgentSpec must be valid YAML/spec before lint diagnostics can run.");
    return;
  }

  if (analysis.lintDiagnostics.length === 0) {
    vscode.window.showInformationMessage("AgentSpec lint passed.");
    return;
  }

  vscode.window.showWarningMessage(`AgentSpec lint found ${analysis.lintDiagnostics.length} issue(s).`);
}

function diagnosticsForDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
  return mapDiagnostics(document, analyzeDocument(document).diagnostics);
}

function analyzeDocument(document: vscode.TextDocument): AgentSpecAnalysis {
  return analyzeAgentSpecText(document.getText(), document.uri.fsPath);
}

function mapDiagnostics(document: vscode.TextDocument, diagnostics: ExtensionDiagnostic[]): vscode.Diagnostic[] {
  return diagnostics.map((diagnostic) => {
    const vscodeDiagnostic = new vscode.Diagnostic(
      rangeForPath(document, diagnostic.path),
      diagnostic.message,
      severityToVscode(diagnostic.severity)
    );
    vscodeDiagnostic.source = diagnostic.source;
    vscodeDiagnostic.code = diagnostic.code;
    return vscodeDiagnostic;
  });
}

function rangeForPath(document: vscode.TextDocument, path: string): vscode.Range {
  const key = path.split(".").find((part) => Number.isNaN(Number(part))) ?? path;
  const keyPattern = new RegExp(`^\s*${escapeRegExp(key)}\s*:`);

  for (let line = 0; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;
    if (keyPattern.test(text)) {
      return new vscode.Range(line, 0, line, Math.max(text.length, 1));
    }
  }

  return new vscode.Range(0, 0, 0, Math.max(document.lineAt(0).text.length, 1));
}

function severityToVscode(severity: ExtensionDiagnostic["severity"]): vscode.DiagnosticSeverity {
  switch (severity) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    case "info":
      return vscode.DiagnosticSeverity.Information;
  }
}

function getActiveAgentSpecDocument(): vscode.TextDocument | undefined {
  const document = vscode.window.activeTextEditor?.document;
  return document && isAgentSpecDocument(document) ? document : undefined;
}

function isAgentSpecDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "agentspec" || /\.agentspec\.ya?ml$/i.test(document.fileName);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
