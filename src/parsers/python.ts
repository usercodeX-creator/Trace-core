export interface ParsedImport {
  packageName: string;
  line: number;
  rawCode: string;
}

const PYTHON_STDLIB = new Set([
  "__future__", "_thread", "abc", "aifc", "argparse", "array", "ast",
  "asynchat", "asyncio", "asyncore", "atexit", "audioop", "base64", "bdb",
  "binascii", "bisect", "builtins", "bz2", "calendar", "cgi", "cgitb",
  "chunk", "cmath", "cmd", "code", "codecs", "codeop", "collections",
  "colorsys", "compileall", "concurrent", "configparser", "contextlib",
  "contextvars", "copy", "copyreg", "cProfile", "crypt", "csv", "ctypes",
  "curses", "dataclasses", "datetime", "dbm", "decimal", "difflib", "dis",
  "distutils", "doctest", "email", "encodings", "ensurepip", "enum",
  "errno", "faulthandler", "fcntl", "filecmp", "fileinput", "fnmatch",
  "fractions", "ftplib", "functools", "gc", "genericpath", "getopt",
  "getpass", "gettext", "glob", "graphlib", "grp", "gzip", "hashlib",
  "heapq", "hmac", "html", "http", "idlelib", "imaplib", "imghdr", "imp",
  "importlib", "inspect", "io", "ipaddress", "itertools", "json",
  "keyword", "lib2to3", "linecache", "locale", "logging", "lzma",
  "mailbox", "mailcap", "marshal", "math", "mimetypes", "mmap",
  "modulefinder", "msilib", "msvcrt", "multiprocessing", "netrc",
  "nntplib", "ntpath", "numbers", "operator", "optparse", "os",
  "ossaudiodev", "parser", "pathlib", "pdb", "pickle", "pickletools",
  "pipes", "pkgutil", "platform", "plistlib", "poplib", "posix",
  "posixpath", "pprint", "profile", "pstats", "pty", "pwd", "py_compile",
  "pyclbr", "pydoc", "queue", "quopri", "random", "re", "readline",
  "reprlib", "resource", "rlcompleter", "runpy", "sched", "secrets",
  "select", "selectors", "shelve", "shlex", "shutil", "signal",
  "site", "smtpd", "smtplib", "sndhdr", "socket", "socketserver",
  "spwd", "sqlite3", "ssl", "stat", "statistics", "string", "stringprep",
  "struct", "subprocess", "sunau", "symtable", "sys", "sysconfig",
  "syslog", "tabnanny", "tarfile", "telnetlib", "tempfile", "termios",
  "test", "textwrap", "threading", "time", "timeit", "tkinter",
  "token", "tokenize", "tomllib", "trace", "traceback", "tracemalloc",
  "tty", "turtle", "turtledemo", "types", "typing", "unicodedata",
  "unittest", "urllib", "uu", "uuid", "venv", "warnings", "wave",
  "weakref", "webbrowser", "winreg", "winsound", "wsgiref", "xdrlib",
  "xml", "xmlrpc", "zipapp", "zipfile", "zipimport", "zlib", "zoneinfo",
]);

/*
 * Extract top-level package names from Python import statements.
 *
 * Handles:
 *   import foo               → foo
 *   import foo.bar           → foo
 *   import foo as f          → foo
 *   from foo import bar      → foo
 *   from foo.bar import baz  → foo
 *
 * Skips:
 *   from . import x          (relative)
 *   from .foo import x       (relative)
 */
export function extractImports(content: string): ParsedImport[] {
  const lines = content.split("\n");
  const results: ParsedImport[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Match "from X import Y"
    const fromMatch = trimmed.match(/^from\s+([\w.]+)\s+import\s/);
    if (fromMatch) {
      const modulePath = fromMatch[1]!;
      // Skip relative imports (starts with .)
      if (modulePath.startsWith(".")) continue;
      const topLevel = modulePath.split(".")[0]!;
      if (!PYTHON_STDLIB.has(topLevel)) {
        results.push({ packageName: topLevel, line: i + 1, rawCode: trimmed });
      }
      continue;
    }

    // Match "import X [as Y]" (possibly multiple comma-separated)
    const importMatch = trimmed.match(/^import\s+(.+)/);
    if (importMatch) {
      const modules = importMatch[1]!.split(",");
      for (const mod of modules) {
        const cleaned = mod.trim().split(/\s+as\s+/)[0]!.trim();
        if (cleaned.startsWith(".")) continue;
        const topLevel = cleaned.split(".")[0]!;
        if (!PYTHON_STDLIB.has(topLevel)) {
          results.push({ packageName: topLevel, line: i + 1, rawCode: trimmed });
        }
      }
    }
  }

  return results;
}
