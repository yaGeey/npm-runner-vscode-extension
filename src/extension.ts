import * as vscode from 'vscode'
import * as fs from 'fs/promises'

let terminal: vscode.Terminal | null = null
let statusBarItem: vscode.StatusBarItem
let path: vscode.Uri
let lastScript: string | undefined = undefined

export function activate(context: vscode.ExtensionContext) {
   statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right)
   statusBarItem.command = 'npm-runner.server'
   context.subscriptions.push(statusBarItem)
   updateStatusBar(lastScript)

   const disposable = vscode.commands.registerCommand('npm-runner.server', async () => {
      const data = await getPackageJsonContent()
      if (!data) return
      const script = data.scripts.dev ? 'dev' : data.scripts.start ? 'start' : Object.keys(data.scripts)[0]

      if (!lastScript && !terminal) await vscode.commands.executeCommand('npm-runner.change-last')
      const scriptToRun = lastScript ?? script

      // Running the npm script
      if (terminal) {
         terminal.dispose()
         terminal = null
         updateStatusBar(lastScript)
      } else {
         terminal = vscode.window.createTerminal({
            name: 'npm-runner',
            cwd: path.fsPath,
         })
         terminal.show(true)
         terminal.sendText(`npm run ${scriptToRun}`)
         updateStatusBar(scriptToRun)
      }
   })

   const changeDefaultScript = vscode.commands.registerCommand('npm-runner.change-last', async () => {
      const data = await getPackageJsonContent()
      if (!data) return
      const scripts = Object.entries(data.scripts) as [string, string][]
      const scriptsWithDesk = scripts.map(([k, v]) => ({
         label: k,
         description: v,
      }))

      await vscode.window
         .showQuickPick(scriptsWithDesk, {
            title: 'Choose default script to run. Ctrl+Alt+W to select again',
         })
         .then((data) => (lastScript = data?.label))
   })

   context.subscriptions.push(disposable)
   context.subscriptions.push(changeDefaultScript)
}

async function getPackageJsonContent(): Promise<Record<any, any> | void> {
   // Getting the workspace folder URI
   const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
   if (!workspaceFolder?.uri) {
      vscode.window.showErrorMessage('No workspace folder is open')
      updateStatusBar(lastScript)
      return
   }
   path = workspaceFolder?.uri

   // Getting the active text editor's document URI
   const active = vscode.window.activeTextEditor?.document.uri
   if (active) {
      const len = path.fsPath.split('\\').length
      const subfolder = active.fsPath
         .split('\\')
         .slice(0, len + 1)
         .join('\\')
      path = vscode.Uri.file(subfolder)
   }

   // Getting package.json
   const packageJsonUri = vscode.Uri.joinPath(path, 'package.json')
   try {
      await vscode.workspace.fs.stat(packageJsonUri) // перевірка чи існує файл
   } catch (err) {
      vscode.window.showErrorMessage('package.json not found in the current workspace folder.')
      return
   }

   // Getting content
   const content = await fs.readFile(packageJsonUri.fsPath, 'utf-8')
   return JSON.parse(content)
}

function updateStatusBar(text: string = '') {
   if (terminal) {
      statusBarItem.text = `$(stop) npm run ${text}`
      statusBarItem.color = '#62bd60'
   } else {
      statusBarItem.text = `$(play) npm run ${text}`
      statusBarItem.color = undefined
   }
   statusBarItem.show()
}

// This method is called when your extension is deactivated
export function deactivate() {
   if (terminal) terminal.dispose()
}
