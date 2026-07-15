import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    // console.log('4d-shtml active');
    context.subscriptions.push(
        // vscode.languages.registerDocumentSemanticTokensProvider(selector, tokensProvider, legend),
        // vscode.languages.registerHoverProvider(selector, hoverProvider),
        // vscode.languages.registerDefinitionProvider(selector, defProvider),
        // vscode.languages.registerCompletionItemProvider(selector, snippetProvider, '#'),
        // vscode.workspace.onDidChangeTextDocument(e => scheduleValidation(e.document)),
    );
    // methodIndex.start(); // fire-and-forget background scan
}


export function deactivate() {}