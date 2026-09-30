---
name: update-dependencies
description: 'Find outdated npm dependencies, upgrade them, and fix the build, type, lint and test errors the upgrades cause. Use when: update dependencies, upgrade packages, outdated packages, npm outdated, bump deps, fix breaking changes after upgrade, dependency maintenance.'
argument-hint: 'Optional: package names to limit the upgrade to, or "minor" to skip major bumps'
---

# Update Dependencies

Upgrades outdated npm packages in this repo and repairs any breakage they introduce.

## Validation Commands

Run from the repo root. All must pass before a batch is considered done.

| Step                  | Command                 |
| --------------------- | ----------------------- |
| Type check            | `npm run tsc:check`     |
| Lint                  | `npm run eslint`        |
| Tests                 | `npm test`              |
| Bundle + declarations | `npm run build`         |
| Lockfile              | `npm run lockfile-lint` |

## Procedure

### 1. Baseline

1. Confirm the git working tree is clean (`git status --porcelain`). If not, stop and ask the user whether to continue.
2. Run all validation commands once and record any failures that already exist. Pre-existing failures are not caused by upgrades — report them, don't attribute them to a package.

### 2. List outdated packages

1. Run `npm outdated --json` (exit code 1 is normal when packages are outdated).
2. Build a table: package, current, wanted, latest, dep/devDep, and whether `latest` is a **major** bump.
3. If the user passed package names, filter to those. If they passed `minor`, drop major bumps.
4. Skip pinned packages and explain why:
   - Exact-version specs in `package.json` (no `^`/`~`, e.g. `hookpoint`) are deliberate pins.
   - `got` is held on v11 (v12+ is a breaking ESM rewrite) — only upgrade if the user explicitly asks.
5. Show the table to the user before changing anything.

### 3. Upgrade in batches

Upgrade in this order, validating after each batch so breakage can be traced to a cause:

1. **Patch/minor updates** together: `npm update`.
2. **Related major updates** together, one group at a time. Keep these groups in lockstep:
   - `eslint`, `@eslint/js`, `@eslint/eslintrc`, `@typescript-eslint/*`, `eslint-plugin-*`, `eslint-config-prettier`
   - `jest`, `@types/jest`
   - `typescript`, `@types/node`
   - `@grpc/grpc-js`, `@grpc/proto-loader`
   - A runtime package and its `@types/*` package (e.g. `ws` + `@types/ws`)
3. **Remaining major updates** one package at a time: `npm install <pkg>@latest` (add `-D` for devDependencies).

Before each major bump, look up the package's changelog / release notes / migration guide (GitHub releases or the npm page) and note the breaking changes.

### 4. Fix errors

After each batch run the validation commands and fix failures in `src/` and `buildSrc/`:

- Fix the actual API change per the migration guide — do not add `// @ts-ignore`, `any` casts, `eslint-disable` comments or skip tests to silence errors.
- Packages that became ESM-only: check `buildSrc/esbuild.js` bundling/externals and `jest.config.js` / `buildSrc/jestEsbuildTransformer.js` (`transformIgnorePatterns`) so jest can load them.
- Changed `@types/*` signatures: update call sites, not the types.
- ESLint major bumps: update `eslint.config.cjs` for renamed/removed rules and config format changes.
- Removed or renamed exports: search usages with the code search tools and update all of them.
- Do not change test expectations unless the new behavior is an intended upstream change; state the reason when you do.

If a package cannot be upgraded without a large rewrite, revert it (`git checkout -- package.json package-lock.json` then `npm install`, or reinstall the previous version) and record it as skipped with the reason.

### 5. Finish

1. Run every validation command one last time; all must match or improve on the baseline.
2. Run `npm run format` so changed files follow prettier.
3. Report to the user:
   - Upgraded packages (old → new)
   - Skipped/pinned packages and why
   - Code changes made for each breaking change
   - Any remaining failures
4. Do not commit or push unless the user asks.
