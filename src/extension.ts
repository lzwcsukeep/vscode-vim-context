import * as vscode from 'vscode';
import { execFile } from 'child_process';


let statusBarItem: vscode.StatusBarItem;

let lastVimRunning: boolean | undefined = undefined;


/**
 * Check whether a process name/command represents Vim or Neovim.
 */
function isVimProcess(comm: string, args: string): boolean {
    const name = comm.trim().toLowerCase();

    if (
        name === 'vim' ||
        name === 'nvim' ||
        name === 'vim.basic' ||
        name === 'vim.tiny' ||
        name === 'vimx'
    ) {
        return true;
    }

    /*
     * Some systems report the executable through args instead of comm.
     *
     * Examples:
     *
     *   /usr/bin/vim
     *   /usr/bin/nvim
     */
    const firstArg = args.trim().split(/\s+/)[0] ?? '';

    const basename =
        firstArg.split('/').pop()?.toLowerCase() ?? '';

    return (
        basename === 'vim' ||
        basename === 'nvim' ||
        basename === 'vimx'
    );
}


/**
 * Execute:
 *
 *     ps -o tpgid= -p <shell-pid>
 *
 * and return the terminal foreground process group id.
 */
function getForegroundProcessGroup(
    shellPid: number
): Promise<number | undefined> {
    return new Promise((resolve) => {
        execFile(
            'ps',
            ['-o', 'tpgid=', '-p', String(shellPid)],
            (error, stdout) => {
                if (error) {
                    resolve(undefined);
                    return;
                }

                const tpgid = parseInt(stdout.trim(), 10);

                if (Number.isNaN(tpgid)) {
                    resolve(undefined);
                    return;
                }

                resolve(tpgid);
            }
        );
    });
}


/**
 * Find out whether Vim/Neovim is the foreground process
 * of the specified terminal shell.
 */
async function detectVim(shellPid: number): Promise<boolean> {
    const tpgid = await getForegroundProcessGroup(shellPid);

    if (tpgid === undefined) {
        return false;
    }

    return new Promise((resolve) => {
        execFile(
            'ps',
            [
                '-eo',
                'pid=,pgid=,comm=,args='
            ],
            (error, stdout) => {
                if (error) {
                    resolve(false);
                    return;
                }

                const lines = stdout.split('\n');

                for (const line of lines) {
                    /*
                     * Expected format:
                     *
                     *   PID PGID COMMAND ARGS
                     */
                    const match = line.match(
                        /^\s*(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/
                    );

                    if (!match) {
                        continue;
                    }

                    const pid = Number(match[1]);
                    const pgid = Number(match[2]);
                    const comm = match[3];
                    const args = match[4];

                    /*
                     * We only care about the foreground
                     * process group.
                     */
                    if (pgid !== tpgid) {
                        continue;
                    }

                    /*
                     * Don't accidentally match unrelated
                     * processes.
                     */
                    if (pid <= 0) {
                        continue;
                    }

                    if (isVimProcess(comm, args)) {
                        return resolve(true);
                    }
                }

                resolve(false);
            }
        );
    });
}


/**
 * Update:
 *
 *     vimRunning
 *
 * and the status bar.
 */
async function updateContext(): Promise<void> {
    const terminal = vscode.window.activeTerminal;

    let vimRunning = false;

    if (terminal !== undefined) {
        try {
            const shellPid = await terminal.processId;

            if (shellPid !== undefined) {
                vimRunning = await detectVim(shellPid);
            }
        } catch {
            vimRunning = false;
        }
    }

    /*
     * Always update the context key.
     *
     * This is important when switching between terminals.
     */
    await vscode.commands.executeCommand(
        'setContext',
        'vimRunning',
        vimRunning
    );

    /*
     * Update status bar only when the state changes.
     */
    if (lastVimRunning !== vimRunning) {
        lastVimRunning = vimRunning;

        statusBarItem.text = vimRunning
            ? '$(terminal) VIM: ON'
            : '$(terminal) VIM: OFF';

        statusBarItem.tooltip = vimRunning
            ? 'Vim/Neovim is running in the active terminal'
            : 'Vim/Neovim is not running in the active terminal';
    }
}


/**
 * Extension entry point.
 */
export function activate(
    context: vscode.ExtensionContext
): void {

    /*
     * Status bar item.
     */
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );

    statusBarItem.text = '$(terminal) VIM: OFF';
    statusBarItem.tooltip =
        'Vim/Neovim is not running in the active terminal';

    statusBarItem.show();

    context.subscriptions.push(statusBarItem);


    /*
     * Manual check command.
     */
    const checkCommand = vscode.commands.registerCommand(
        'vimTerminalContext.check',
        async () => {
            await updateContext();

            vscode.window.showInformationMessage(
                lastVimRunning
                    ? 'Vim/Neovim is running'
                    : 'Vim/Neovim is not running'
            );
        }
    );

    context.subscriptions.push(checkCommand);


    /*
     * Active terminal changed.
     */
    const activeTerminalListener =
        vscode.window.onDidChangeActiveTerminal(() => {
            /*
             * Force immediate refresh.
             */
            lastVimRunning = undefined;
            void updateContext();
        });

    context.subscriptions.push(activeTerminalListener);


    /*
     * Initial detection.
     */
    void updateContext();


    /*
     * Poll every 300ms.
     *
     * Why polling?
     *
     * VS Code does not provide a direct event saying:
     *
     *     "foreground process of terminal changed"
     *
     * Therefore we inspect the terminal process group periodically.
     */
    const timer = setInterval(() => {
        void updateContext();
    }, 300);

    context.subscriptions.push({
        dispose: () => clearInterval(timer)
    });
}


export function deactivate(): void {
    /*
     * Nothing special is required here.
     */
}