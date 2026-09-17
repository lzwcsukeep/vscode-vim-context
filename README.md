# Vim Terminal Context

A VS Code extension that detects whether **Vim / Neovim is running in the active integrated terminal** and exposes the result as a VS Code context key.

This allows you to control VS Code keybindings with the `when` clause, for example:

```json
{
    "key": "ctrl+p",
    "command": "workbench.action.quickOpen",
    "when": "!vimRunning"
}
```

When Vim is running in the active terminal, the `vimRunning` context key becomes `true`, so VS Code keybindings can be disabled selectively and the key can be passed to Vim instead.

## Features

* Detects `vim` and `nvim` running in the active VS Code integrated terminal
* Uses the Linux terminal foreground process group to identify Vim
* Exposes a VS Code context key:

```text
vimRunning
```

* Displays the current Vim state in the VS Code status bar:

```text
VIM: ON
```

or

```text
VIM: OFF
```

* Automatically updates when:

  * Vim / Neovim starts
  * Vim / Neovim exits
  * The active terminal changes
* Works with VS Code Remote SSH environments

## How It Works

VS Code does not provide a direct API that tells an extension which process is currently in the foreground of an integrated terminal.

This extension therefore uses the Linux process group information.

The basic process is:

```text
VS Code Integrated Terminal
        │
        │ terminal.processId
        ▼
     Shell PID
        │
        │ ps -o tpgid=
        ▼
Foreground Process Group ID
        │
        │ ps -eo pid,pgid,comm,args
        ▼
Check processes in the group
        │
        ├── vim
        └── nvim
        │
        ▼
setContext("vimRunning", true/false)
        │
        ▼
VS Code keybindings.json
```

For example, when Vim is running:

```text
vimRunning = true
```

When Vim exits:

```text
vimRunning = false
```

## Why Use a Context Key?

VS Code keybindings support conditional execution through the `when` clause.

For example:

```json
{
    "key": "ctrl+p",
    "command": "workbench.action.quickOpen",
    "when": "!vimRunning"
}
```

This means:

```text
Vim not running
    │
    └── Ctrl+P → VS Code Quick Open

Vim running
    │
    └── This VS Code binding is inactive
```

This is useful when you want Vim to receive its normal keyboard shortcuts without VS Code intercepting them.

## Installation

### Option 1: Install from VSIX

Build the extension:

```bash
npm install
npm run compile
```

Install `vsce`:

```bash
npm install -g @vscode/vsce
```

Package the extension:

```bash
vsce package --allow-missing-repository
```

This generates a file similar to:

```text
vim-terminal-context-0.0.2.vsix
```

Then in VS Code:

1. Open the Command Palette
2. Run:

```text
Extensions: Install from VSIX...
```

3. Select the generated `.vsix` file
4. If using Remote SSH, install it into the **Remote SSH environment**

For example:

```text
SSH: Ubuntu
└── Vim Terminal Context
```

The extension needs to run on the Ubuntu host because it uses Linux process information such as `ps`.

## Remote SSH

This extension is designed to work with environments such as:

```text
Windows
   │
   │ Remote SSH
   ▼
Ubuntu
   │
   ├── VS Code Server
   ├── Integrated Terminal
   └── Vim / Neovim
```

Make sure the extension is installed on the remote Ubuntu side.

The Linux `ps` command is used to inspect the terminal's foreground process group.

## Configuration

For the best terminal experience, add the following to VS Code `settings.json`:

```json
{
    "terminal.integrated.sendKeybindingsToShell": true,
    "terminal.integrated.allowChords": false
}
```

Then use `vimRunning` in `keybindings.json`.

### Example: Ctrl+P

```json
{
    "key": "ctrl+p",
    "command": "workbench.action.quickOpen",
    "when": "!vimRunning"
}
```

### Example: Ctrl+W

```json
{
    "key": "ctrl+w",
    "command": "workbench.action.closeActiveEditor",
    "when": "!vimRunning"
}
```

With these bindings:

```text
                    Ctrl+P
                       │
                       ▼
                vimRunning ?
                 /          \
               no            yes
               │              │
               ▼              ▼
         VS Code Quick Open   VS Code binding disabled
                              │
                              ▼
                             Vim
```

## Testing

After installing the extension, open an integrated terminal.

Initially:

```text
VIM: OFF
```

Start Vim:

```bash
vim
```

The status bar should change to:

```text
VIM: ON
```

Exit Vim:

```vim
:q
```

The status bar should return to:

```text
VIM: OFF
```

You can also test the `vimRunning` context key with a temporary keybinding:

```json
{
    "key": "ctrl+alt+v",
    "command": "workbench.action.files.openFile",
    "when": "vimRunning"
}
```

Expected behavior:

```text
Vim OFF
Ctrl+Alt+V
    ↓
Nothing happens


Vim ON
Ctrl+Alt+V
    ↓
VS Code Open File dialog
```

If this works, it confirms that the extension is correctly setting the `vimRunning` context key.

## Development

Clone the repository:

```bash
git clone https://github.com/lzwcsukeep/vscode-vim-context.git
cd vscode-vim-context
```

Install dependencies:

```bash
npm install
```

Compile:

```bash
npm run compile
```

For development, use TypeScript watch mode:

```bash
npm run watch
```

## Project Structure

```text
vscode-vim-context/
│
├── package.json
├── tsconfig.json
│
├── src/
│   └── extension.ts
│
├── out/
│   ├── extension.js
│   └── extension.js.map
│
└── README.md
```

The main implementation is in:

```text
src/extension.ts
```

## Requirements

* VS Code `1.90.0` or later
* Linux
* Node.js 20 or later for development
* `ps` command
* Vim or Neovim

The extension is particularly useful with:

* Ubuntu
* VS Code Remote SSH
* VS Code Integrated Terminal
* Vim
* Neovim

## Supported Vim Variants

The extension currently recognizes:

```text
vim
nvim
vim.basic
vim.tiny
vimx
```

It also checks the executable name contained in the process arguments.

## Limitations

### Linux-focused

The current implementation relies on Linux process information:

```bash
ps
```

and terminal process groups.

Therefore, the implementation is currently intended primarily for Linux environments.

### Context key scope

The context key describes Vim running in the **active integrated terminal**.

For example:

```text
Terminal A
└── vim

Terminal B
└── bash
```

When Terminal A is active:

```text
vimRunning = true
```

When Terminal B is active:

```text
vimRunning = false
```

### Keybinding behavior

The `when` clause only controls whether a particular VS Code keybinding matches.

For example:

```json
"when": "!vimRunning"
```

does not itself send the key to Vim.

Terminal key forwarding still depends on VS Code's terminal keyboard handling and the other active keybindings.

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, subject to the conditions of the MIT License.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
