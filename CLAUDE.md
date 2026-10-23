# Colony-Builder

Colony builder. TypeScript, webpack, pnpm.

## Commands

`pnpm findissues` (typecheck + oxlint + prettier check), `pnpm test` (vitest), `pnpm build`, `pnpm watch`, `pnpm lib-docs` (see below). Don't start the watcher or dev server; ask the user to run it.

## Code style

- Prettier: double quotes, `arrowParens: avoid`, `trailingComma: es5`, sorted imports. Run `pnpm format` rather than hand-formatting.
- Relative imports include the `.ts` extension.
- Oxlint is type-aware and strict: no `any`, no non-null `!`, `consistent-type-imports` (use `import type`), no unnecessary conditions. Prefix intentionally unused args with `_`.
- Prefer expressions and small pure helpers over classes. Go for elegance/perfectionism.

## Libraries - prefer these over hand-rolled code

### Where the API lives

This file deliberately does not list what each library exports, because that goes stale. Read it from the generated reference instead:

- `.claude/lib-docs/<package>.md` - one file per library: version, import paths, and every type declaration (signatures and doc comments). Generated from the installed `node_modules` by `scripts/lib-docs.mjs` on `pnpm install` (`postinstall`), or on demand with `pnpm lib-docs`. Gitignored. Packages with scoped names use `__` in place of `/`.
- The allowlist is the `claudeLibDocs` array in `package.json`. Add a dependency's name there to get it documented.
- `node_modules/<package>/README.md` has usage prose and examples. READMEs can be wrong or stale; the declarations are the source of truth.
- If `.claude/lib-docs/` is missing or looks out of date, run `pnpm lib-docs` first.

**Before writing any utility, maths or guard by hand, search the relevant `lib-docs` file for an existing one.** Some of these files are large (niall-utils is the biggest), so search them by name and read the matching section instead of loading the whole file. `node_modules` is not in the codebase graph, so use Read/Grep on these files.

### vectyped (`Vector`, `Matrix`)

Use for all 2D/3D maths: positions, directions, bounds, colours-as-tuples.

- The vector size is in the type (`Vector<2>`).
- Arithmetic methods **mutate in place** and return `this`. Call `.copy()` first if the original is still needed. Some operations have a non-mutating twin (e.g. `getNorm()` vs `normalise()`), so check the declaration.
- Operands may be a number, another vector or a raw tuple.
- Prefer the built-in operations (distance, dot product, angle, rotation, bounds checks, equality) over manual maths.
- Components are read with methods (`x()`, `y()`), not properties.
- Vectors spread into canvas calls via `.toArray()`.

### niall-utils

Use for DOM, functional and data helpers: element lookup and typed listeners instead of raw `querySelector` plus null checks, `raise` for throwing in expression position, `attempt` instead of try/catch blocks, `pipe` / `Option` / typed object helpers instead of ad-hoc chains, plus maths, colour, animation-sequence and timing helpers. Import from the package root; subpath imports also exist (see the `Import paths` line in its lib-docs file).

### seriform

Defines the config UI and syncs it to the URL query string, so settings are shareable.

- Build the config with `createParsers({ "kebab-id": someParser({...}) })`. The `Config` type is derived from it, so never write it by hand.
- Parser kinds: value parsers, collection parsers (table / list / group), content elements (no value), and conditional parsers (`when` / `unless` / `ifParser`) driven by `equals` / `satisfies` / `derived`. Conditional paths are type-checked.
- Read values through the `SeriForm` instance (`getValue`, `getAllValues`, `addListener`). Don't read the DOM inputs directly.

### deep-guards

Runtime type guards for `unknown` data (parsed JSON, network messages, `localStorage`). Prefer these over `as` casts.

- Derive the static type from a guard instead of declaring it twice.
- Build guards once at module level and reuse them; some precompute their checks.
- Check the object guard's behaviour for empty objects and extra keys in its declarations before relying on it.

### method-monitor

Lightweight profiling of methods and functions. Use it when asked about performance, not by default.

- Its README's quick example imports from `@web-art/profile`; the real package name is `method-monitor`.
- Patching an object mutates its methods in place.

## Tooling

- Tests: vitest with jsdom. Put `*.test.ts` next to the code.
- Build: webpack + babel (`@babel/preset-typescript`), terser for minification, browser-sync for `pnpm watch`.
- Node >= 25.4 (TypeScript 7, native type stripping for `node src/...ts`).
