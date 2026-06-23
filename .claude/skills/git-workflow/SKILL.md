---
name: git-workflow
description: "Enforces strict git workflow with conventional commits, branch management, atomic commits, history cleanup, and PR creation. Use when the user wants to commit, push, create a branch/PR, rebase, squash, or mentions 'git', 'commit', 'push', 'pull request', 'branch', 'merge', 'rebase', 'squash', 'atomic commit'. Ensures each commit is self-contained, passes lint/build checks, and follows the project's commit conventions (feat/fix/docs/refactor/chore/style/test). Never commits directly to main/master without explicit user approval."
version: 1.0.0
author: Open Flow Algorithm Team
license: MIT
tags:
  - git
  - workflow
  - conventional-commits
  - branching
  - PR
  - atomic-commits
agents:
  - claude-code
---

# Git Workflow Skill — Conventional Commits + Branch Management

Strict git workflow enforcing conventional commits, atomic changes, and proper branch hygiene. Follows the project's established commit conventions (see git log for reference).

## Workflow Phases

When the user asks to make changes that should be committed, follow this workflow:

### Phase 0: Assess Current State

```bash
git status
git branch --show-current
git log --oneline -5
```

Verify:
- Current branch is appropriate for the work (NOT main/master unless user explicitly approved)
- Working tree is clean or has intentional changes
- Recent commits follow project conventions

### Phase 1: Branch Management

**Starting new work:**
```bash
# Create a descriptive feature branch from the target base
git checkout -b feat/<short-description> <base-branch>
```

**Branch naming conventions (match the project):**
- `feat/` — new features
- `fix/` — bug fixes
- `docs/` — documentation only
- `refactor/` — code restructuring
- `chore/` — maintenance, tooling, deps
- `style/` — formatting, CSS, UI polish
- `test/` — tests only

**Example:** `feat/new-file-dialog`, `fix/external-link-opening`, `refactor/move-python-backend`

### Phase 2: Atomic Commits

Each commit must be **self-contained** — one logical change, one conventional commit type. A commit must:
1. Pass `pnpm build:web` (TypeScript check + Vite build) before committing
2. Have a properly formatted message
3. Be scoped to a single concern

**Commit message format:**
```
<type>: <short description>

<optional body with details>
```

**Types (from project conventions):**
- `feat:` — new feature (e.g., `feat: add NewFileDialog with Python code import`)
- `fix:` — bug fix (e.g., `fix: resolve external link opening in Tauri mode`)
- `docs:` — documentation (e.g., `docs: update CLAUDE.md with new architecture`)
- `refactor:` — code restructuring (e.g., `refactor: move python-backend to app/`)
- `chore:` — maintenance (e.g., `chore: ignore dist-web, remove from tracking`)
- `style:` — styling/formatting changes (no logic changes)
- `test:` — adding or updating tests

**Before committing:**
```bash
cd app && pnpm build:web   # TypeScript check + Vite build
```

If the build fails, fix errors before committing. Do NOT commit failing code.

**Committing:**
```bash
git add <specific-files>
git commit -m "<type>: <description>"
```

**NEVER** use `git add -A` or `git add .` without reviewing what's being staged. Always list specific files.

**Commit after successful build only.** If the build fails, fix the issues first, rebuild, then commit.

### Phase 3: Push & PR

**Push:**
```bash
git push -u origin <branch-name>
```

**PR creation (if the project uses GitHub PRs):**
After pushing, summarize changes and offer to create a PR. The project's main branch for PRs is `master`; the development branch is `main`.

### Phase 4: History Cleanup (on request)

When the user asks to clean up, squash, or rebase:
```bash
# Interactive rebase — CAUTION: only when user explicitly requests
git rebase -i <base>
```

Explain what each operation does before executing. Never force-push (`--force`) without explicit user confirmation.

### Phase 5: Merge

Only merge into main/master branches when the user explicitly requests it. Use `--no-ff` for feature merges to preserve branch history:
```bash
git checkout main
git merge --no-ff feat/<feature-name>
```

## Safety Rules

1. **NEVER commit directly to `main` or `master`** without explicit user approval. Always ask: "You're on the main branch. Should I create a feature branch for this work?"
2. **NEVER force-push** (`git push --force`, `git push -f`, `git push --force-with-lease`) without explicit user confirmation. Explain the risk.
3. **NEVER run destructive commands** (`git reset --hard`, `git clean -fd`, `git branch -D`) without explicit user confirmation. First show what would be lost: `git status`, `git stash list`.
4. **ALWAYS verify the build passes** before committing (use `pnpm build:web`).
5. **ALWAYS review staged changes** before committing. Show the user what files changed and what the commit message will be.
6. **Keep commits small and focused** — one concern per commit. If multiple logical changes exist, commit them separately with appropriate types.

## Project-Specific Conventions

- **Package manager:** pnpm (not npm)
- **Build check:** `cd app && pnpm build:web`
- **Base branches:** `main` (development), `master` (upstream PR target)
- **Workspace:** `app/` directory (frontend + Tauri)
- **Git user:** theAbsurd
- **Commit overflow refs:** Known recent project commits include `feat:`, `docs:`, `refactor:`, `chore:` types — follow this pattern

## Quick Reference

| User says | Phase | What to do |
|-----------|-------|------------|
| "commit this" | Phase 2 | Build check → review files → atomic commit |
| "start a new feature" | Phase 1 | Branch from `main` → implement |
| "push" / "create a PR" | Phase 3 | Push branch → summarize → offer PR |
| "clean up commits" | Phase 4 | Show history → plan squash → rebase |
| "merge to main" | Phase 5 | Confirm intent → `--no-ff` merge |
