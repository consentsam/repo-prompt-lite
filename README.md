# Repo-Prompt Lite


A macOS-only desktop utility built with Electron + React 18 + Vite + Tailwind (dark theme).
Helps you select and copy code snippets from large local codebases, up to 2 million tokens (~8 MB) in one shot.

⸻

🚀 Features
	1.	Import a folder via file picker or drag-and-drop
	2.	Collapsible file tree with tri-state checkboxes
	3.	Live token & file count to stay within budget
	4.	ASCII <file_map> + code block <file_contents> generator
	5.	Skip binaries & large files automatically (≥ 1 MB)
	6.	One-click "Copy" to system clipboard

⸻

🧰 Tech Stack
| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Electron 29 + Vite | Desktop shell + fast bundling |
| UI Library | React 18 | Component-based interface |
| Styling | Tailwind CSS (dark-only) | Utility classes, dark theme |
| Virtual List | @tanstack/react-virtual | Performance for huge file trees |
| State | React Context + Immer | Simple immutable state logic |
| Clipboard | Electron API | Native copy support |
| Formatting | ESLint, Prettier | Code style enforcement |
| Testing | Vitest + React Testing Library | Unit & component tests |
| E2E | Playwright | End-to-end desktop tests |
| Packaging | electron-builder | macOS .dmg packaging |



⸻

📦 Installation & Development

```bash
# Clone the repo and navigate in
git clone <your-repo-url> repo-prompt-clone
cd repo-prompt-clone

# Install dependencies
npm install

# Start in development mode
npm run dev
```


	4.	A new Electron window will open at http://localhost:5173.

⸻

⚙️ Project Structure

```text
repo-prompt-clone/
├─ .cursor/                  # Cursor AI rules & hooks
├─ docs/
│  ├─ ARCHITECTURE.md        # System overview & diagrams
│  ├─ UX.md                  # User-flow & wireframe specs
│  └─ step-notes/            # Auto-generated step summaries
├─ public/                   # Static assets
├─ src/
│  ├─ components/            # React UI components
│  ├─ hooks/                 # Custom React hooks
│  ├─ services/              # Filesystem + API wrappers
│  ├─ utils/                 # Pure helper functions
│  ├─ types/                 # Shared TypeScript types
│  ├─ main/                  # Electron main & preload scripts
│  └─ renderer/              # React entrypoint & App.tsx
├─ .env.example              # Sample environment variables
├─ package.json              # Scripts, dependencies & Cursor hook
├─ tsconfig.json             # TypeScript compiler config
└─ tailwind.config.js        # Tailwind CSS setup
```



⸻

🌟 Usage
	1.	Open the app.
	2.	Pick or drop a code folder.
	3.	Expand the tree on the left to see files and subfolders.
	4.	Check the boxes next to files you want to include.
	5.	Watch the token count in the toolbar—don't exceed 2 M.
	6.	Click "Copy" to copy the <file_map> + <file_contents> payload.
	7.	Paste anywhere (terminal, editor, chat) for instant context.

⸻

🔧 Environment Variables

Copy .env.example to .env and fill in values:

cp .env.example .env

	•	VITE_GITHUB_TOKEN (optional) – Personal GitHub token for higher API rate limits
	•	ELECTRON_DISABLE_SECURITY_WARNINGS – Set to true in dev to silence warnings

⸻

📋 Implementation Plan

All development is guided by a step-by-step plan in
.cursor/rules/001-implementation-plan.mdc.
Each step is:
	1.	Scaffolded by the AI
	2.	Documented in docs/step-notes/
	3.	Checked off in the plan file

To start, open Cursor IDE and ask:

Begin Step 0.1 and stop when it's complete.

Then iterate through Step 0.2 → 7.2 to fully build the app.

⸻

🤝 Contributing (Solo Workflow)
	1.	Follow the plan: one step per commit.
	2.	Pre-commit hooks run ESLint & Prettier.
	3.	After core features are done, CI will run lint, unit tests, and E2E tests on GitHub.

⸻

📝 License

MIT © Satyajeet Sindhiyani

