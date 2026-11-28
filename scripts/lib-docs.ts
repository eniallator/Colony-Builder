// Generates a per-package API reference from the installed type declarations,
// so Claude can read the exact surface of the libraries this project uses.
//
// Packages come from the `claudeLibDocs` allowlist in package.json. Output goes
// to `.claude/lib-docs/<package>.md` (gitignored, regenerated on `pnpm install`).
//
// Never fails the install: problems are reported as warnings.
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isAnyRecord,
  isArrayOf,
  isObjectOf,
  isOptional,
  isString,
  isUnknown,
  type Guard,
  type TypeFromGuard,
} from "deep-guards";
import { raise } from "niall-utils/core";

const isRootPackage = isObjectOf({ claudeLibDocs: isOptional(isUnknown) });
const isPackage = isObjectOf({
  version: isString,
  exports: isOptional(isUnknown),
  types: isOptional(isString),
  typings: isOptional(isString),
});
type Package = TypeFromGuard<typeof isPackage>;
const isTypedExport = isObjectOf({ types: isString });
const isPackageList = isArrayOf(isObjectOf({ path: isString }));
const isNames = isArrayOf(isString);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".claude", "lib-docs");

const parseJson = <T>(source: string, guard: Guard<T>, from: string): T => {
  const json: unknown = JSON.parse(source);
  return guard(json)
    ? json
    : raise(new Error(`unexpected shape of JSON from ${from}`));
};
const readJson = <T>(path: string, guard: Guard<T>): T =>
  parseJson(readFileSync(path, "utf8"), guard, path);
const posix = (path: string) => path.replaceAll("\\", "/");
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Declaration file for an import specifier, e.g. "./x.js" -> "<dir>/x.d.ts" */
const resolveDeclaration = (fromDir: string, specifier: string) => {
  const base = resolve(fromDir, specifier.replace(/\.(?:[cm]?[jt]s)$/, ""));
  return [`${base}.d.ts`, join(base, "index.d.ts")].find(existsSync) ?? null;
};

/** Every `types` target in package.json, keyed by public import path. */
const typeEntries = (
  name: string,
  pkg: Package
): [path: string, types: string][] => {
  const exported = isAnyRecord(pkg.exports) ? pkg.exports : {};
  const fromExports = Object.entries(exported).flatMap(
    ([subpath, target]): [string, string][] =>
      isTypedExport(target)
        ? [
            [
              subpath === "." ? name : `${name}/${subpath.slice(2)}`,
              target.types,
            ],
          ]
        : []
  );
  const rootTypes = pkg.types ?? pkg.typings;
  return fromExports.length > 0 || rootTypes == null
    ? fromExports
    : [[name, rootTypes]];
};

const relativeSpecifiers = (source: string) =>
  [...source.matchAll(/\bfrom\s+["'](\.[^"']*)["']/g)].flatMap(
    ([, specifier]) => (specifier != null ? [specifier] : [])
  );

/** Depth-first crawl, so files appear next to the barrel that exports them. */
const crawl = (entryFiles: string[]) => {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const dir = dirname(file);
    for (const specifier of relativeSpecifiers(readFileSync(file, "utf8"))) {
      const next = resolveDeclaration(dir, specifier);
      if (next != null) visit(next);
    }
  };
  entryFiles.forEach(visit);
  return [...seen];
};

const tidy = (source: string) =>
  source
    .replace(/^\/\/# sourceMappingURL=.*$/gm, "")
    .replace(/^export \{\};?$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * Workspace packages install their own dependencies, so look in each. Asks pnpm
 * for the packages, so a new workspace package needs no change here.
 */
const workspaceDirs = () => {
  const listing = execSync("pnpm ls -r --depth -1 --json", {
    cwd: root,
    encoding: "utf8",
  });
  return [
    root,
    ...parseJson(listing, isPackageList, "pnpm ls").map(({ path }) => path),
  ].map(dir => join(dir, "node_modules"));
};

const render = (name: string, workspaceDirs: string[]) => {
  const pkgDir = join(
    workspaceDirs.find(dir => existsSync(join(dir, name))) ??
      join(root, "node_modules"),
    name
  );
  const pkg = readJson(join(pkgDir, "package.json"), isPackage);
  const entries = typeEntries(name, pkg);
  const entryFiles = entries.map(([, types]) => resolve(pkgDir, types));
  const missing = entryFiles.filter(file => !existsSync(file));
  if (entries.length === 0 || missing.length > 0) {
    throw new Error("no usable type declarations");
  }

  const readme = ["README.md", "readme.md"].find(file =>
    existsSync(join(pkgDir, file))
  );
  const files = crawl(entryFiles).map(file => {
    const path = posix(relative(pkgDir, file));
    return `## ${path}\n\n\`\`\`ts\n${tidy(readFileSync(file, "utf8"))}\n\`\`\``;
  });

  return [
    `# ${name}@${pkg.version}`,
    "",
    "Generated from the installed type declarations by `scripts/lib-docs.ts`. Do not edit.",
    "",
    `Import paths: ${entries.map(([path]) => `\`${path}\``).join(", ")}`,
    readme != null
      ? `\nUsage prose: \`${posix(relative(root, join(pkgDir, readme)))}\``
      : "",
    "",
    ...files.flatMap(file => [file, ""]),
  ].join("\n");
};

const main = () => {
  const allowlist = readJson(
    join(root, "package.json"),
    isRootPackage
  ).claudeLibDocs;
  rmSync(outDir, { recursive: true, force: true });
  if (!isNames(allowlist) || allowlist.length === 0) return;

  mkdirSync(outDir, { recursive: true });
  const dirs = workspaceDirs();
  for (const name of allowlist) {
    try {
      writeFileSync(
        join(outDir, `${name.replaceAll("/", "__")}.md`),
        render(name, dirs)
      );
    } catch (error) {
      console.warn(`lib-docs: skipped ${name}: ${messageOf(error)}`);
    }
  }
};

try {
  main();
} catch (error) {
  console.warn(`lib-docs: failed: ${messageOf(error)}`);
}
