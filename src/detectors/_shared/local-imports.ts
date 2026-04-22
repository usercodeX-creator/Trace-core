/**
 * Local-import prefixes per language.
 *
 * Any import specifier starting with one of these is NEVER a remote package.
 * Package-existence / package-name detectors must skip these.
 */

/** JS / TS — framework path aliases, relative, absolute, node: builtins */
export const LOCAL_PREFIXES_JS = [
  "./", "../", "/",        // relative + absolute
  "@/",                    // Next.js / Vite / CRA default tsconfig path alias
  "~/",                    // Nuxt 3, some Vite configs
  "#/",                    // Node.js package.json "imports" subpath
  "@@/",                   // UmiJS
  "#",                     // bare # subpath imports (e.g. "#internal/x")
  "node:",                 // explicit Node built-in
];

/** Python — relative imports */
export const LOCAL_PREFIXES_PY = [
  ".",                     // from .foo / from ..bar
];

/** Go — relative paths and module-internal */
export const LOCAL_PREFIXES_GO = [
  "./", "../",
];

/** Rust — crate-local use paths */
export const LOCAL_PREFIXES_RUST = [
  "crate::", "super::", "self::",
];

/** Ruby — relative require paths */
export const LOCAL_PREFIXES_RUBY = [
  "./", "../",
];

/** Check whether a specifier is local for the given language prefix list. */
export function isLocalImport(specifier: string, prefixes: readonly string[]): boolean {
  return prefixes.some(p => specifier.startsWith(p));
}

/**
 * Scoped npm package regex — scope must be 1+ alphanumeric chars.
 * Rejects @/lib, ~/foo, #/bar (empty or non-alpha scope).
 */
export const SCOPED_PKG_RE = /^@[a-z0-9][\w.-]*\/[a-z0-9][\w.-]+(\/.*)?$/i;
