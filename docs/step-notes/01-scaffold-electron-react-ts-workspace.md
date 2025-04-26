# 01-scaffold-electron-react-ts-workspace

## What
We scaffolded and fixed the Electron + React + TypeScript workspace with:
- Initialised Electron 30 and configured Vite via `electron.vite.config.cjs` (fixed module loading issues)
- Set up React 18 and TypeScript with `tsconfig.json`
- Added Tailwind CSS configuration (`tailwind.config.js`, `postcss.config.cjs`) and set up dark mode
- Configured ESLint (`.eslintrc.cjs`) and Prettier (`.prettierrc`)
- Added Husky pre-commit hook for lint-staged in `package.json`
- Created base files: `src/main/main.ts`, `src/renderer/index.tsx`, `src/renderer/App.tsx`, `src/renderer/index.css` and `src/renderer/index.html`
- Implemented a minimal preload script (`src/preload/index.ts`) with contextBridge
- Fixed module type issues by switching from ES modules to CommonJS for config files
- Updated main process to correctly use Vite's dev server URL via environment variables

## Testing
Run `npm run dev` and verify that:
1. A desktop window opens.
2. The React app renders "Hello, Repo Prompt Lite!" styled by Tailwind.
3. Pre-commit hook prevents commits with linting or formatting errors.

## Follow-ups
- Extend the preload script with secure IPC methods for folder picking.
- Adjust browser window options (contextIsolation, nodeIntegration).
- Finalise `electron-builder` settings for macOS packaging. 