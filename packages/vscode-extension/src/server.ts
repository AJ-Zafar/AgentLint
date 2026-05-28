import {
  CodeActionKind,
  CompletionItemKind,
  createConnection,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  InsertTextFormat,
  MarkupKind,
  ProposedFeatures,
  TextDocumentSyncKind
} from "vscode-languageserver/node.js";
import { TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  getAgentLintCodeActions,
  getAgentLintCompletions,
  getAgentLintDefinition,
  getAgentLintDiagnostics,
  getAgentLintHover
} from "./languageFeatures.js";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: { resolveProvider: false },
    hoverProvider: true,
    codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
    definitionProvider: true
  }
}));

connection.onInitialized(() => {
  connection.client.register(DidChangeConfigurationNotification.type, undefined).catch(() => undefined);
});

documents.onDidChangeContent((change) => validate(change.document));
documents.onDidOpen((event) => validate(event.document));

connection.onCompletion((params) => {
  const document = documents.get(params.textDocument.uri);
  return document ? getAgentLintCompletions(document.getText()) : [];
});

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  return document ? getAgentLintHover(document.getText(), params.position.line, params.position.character) ?? null : null;
});

connection.onDefinition((params) => {
  const document = documents.get(params.textDocument.uri);
  return document ? getAgentLintDefinition(document.getText(), document.uri, params.position.line, params.position.character) ?? null : null;
});

connection.onCodeAction((params) => {
  const document = documents.get(params.textDocument.uri);
  return document ? getAgentLintCodeActions(document.getText(), params.context.diagnostics) : [];
});

async function validate(document: TextDocument): Promise<void> {
  connection.sendDiagnostics({ uri: document.uri, diagnostics: getAgentLintDiagnostics(document.getText(), document.uri) });
}

documents.listen(connection);
connection.listen();

// Keep these imports referenced for bundlers/type checking when protocol enum values tree-shake differently.
void CompletionItemKind;
void DiagnosticSeverity;
void InsertTextFormat;
void MarkupKind;
