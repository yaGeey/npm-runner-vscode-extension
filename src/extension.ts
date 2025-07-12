import * as vscode from 'vscode'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import * as fs from 'fs/promises'
import kill from 'tree-kill'

let devProcess: ChildProcessWithoutNullStreams | null = null
let statusBarItem: vscode.StatusBarItem
let path: vscode.Uri

export function activate(context: vscode.ExtensionContext) {
   statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right)
   statusBarItem.command = 'npm-dev-runner.toggleDevServer'
   context.subscriptions.push(statusBarItem)
   updateStatusBar()

   const disposable = vscode.commands.registerCommand('npm-dev-runner.toggleDevServer', async () => {
      // -- Getting the workspace folder URI
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (!workspaceFolder?.uri) {
         vscode.window.showWarningMessage('No workspace folder is open')
         updateStatusBar()
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
         vscode.window.showWarningMessage('package.json not found in the current workspace folder.')
         return
      }

      // Getting scripts
      const content = await fs.readFile(packageJsonUri.fsPath, 'utf-8')
      const data = JSON.parse(content)
      const script = data.scripts.dev ? 'dev' : data.scripts.start ? 'start' : Object.keys(data.scripts)[0]

      // Output Channel
      const outputChannel = vscode.window.createOutputChannel('npm-dev-runner')
      outputChannel.show(true)

      // Running the npm script
      if (devProcess) {
         kill(devProcess.pid!, 'SIGTERM')
         devProcess = null
         updateStatusBar()
      } else {
         devProcess = spawn('npm', ['run', script], {
            cwd: path.fsPath,
            shell: true,
         })
         devProcess.stdout.on('data', (data) => outputChannel.append(data.toString()))
         devProcess.stderr.on('data', (data) => outputChannel.append(data.toString()))
         devProcess.on('close', (code) => {
            devProcess = null
            updateStatusBar()
         })
         updateStatusBar(`npm run ${script}`)
      }
   })

   context.subscriptions.push(disposable)
}

function updateStatusBar(text: string = 'Script') {
   if (devProcess) {
      statusBarItem.text = `$(stop) ${text}`
      statusBarItem.color = '#62bd60'
   } else {
      statusBarItem.text = `$(play) ${text}`
      statusBarItem.color = undefined
   }
   statusBarItem.show()
}

// This method is called when your extension is deactivated
export function deactivate() {
   if (devProcess) devProcess.kill()
}
