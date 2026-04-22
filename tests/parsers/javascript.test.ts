import { describe, it, expect } from "vitest";
import { extractImports } from "../../src/parsers/javascript.js";

describe("JavaScript parser", () => {
  it("extracts a default import", () => {
    const result = extractImports('import foo from "bar"');
    expect(result.map((r) => r.packageName)).toEqual(["bar"]);
  });

  it("extracts scoped package and normalizes sub-path", () => {
    const result = extractImports('import { x } from "@scope/pkg/sub"');
    expect(result.map((r) => r.packageName)).toEqual(["@scope/pkg"]);
  });

  it("skips Node.js builtins", () => {
    const result = extractImports('import fs from "fs"');
    expect(result).toEqual([]);
  });

  it("skips node: prefix builtins", () => {
    const result = extractImports('import fs from "node:fs"');
    expect(result).toEqual([]);
  });

  it("skips relative require", () => {
    const result = extractImports('const x = require("./local")');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// v0.6.1 regression — framework path aliases must be skipped by parser
// ---------------------------------------------------------------------------

describe("JavaScript parser: path alias exclusions", () => {
  const excluded: [string, string][] = [
    ['import { auth } from "@/lib/auth";', "@/ path alias"],
    ['import x from "~/composables/useX";', "~/ path alias"],
    ['import x from "#/internal/x";', "#/ subpath import"],
    ['import x from "#internal/x";', "# bare subpath import"],
    ['import x from "@@/plugin-foo";', "@@/ UmiJS alias"],
    ['import x from "/absolute/path";', "absolute / path"],
    ['import x from "../bar/baz";', "relative ../ path"],
    ['import x from "node:fs/promises";', "node: builtin"],
  ];

  for (const [code, label] of excluded) {
    it(`skips ${label}`, () => {
      const result = extractImports(code);
      expect(result).toEqual([]);
    });
  }

  it("still extracts valid scoped packages", () => {
    const result = extractImports('import x from "@anthropic-ai/sdk"');
    expect(result.map(r => r.packageName)).toEqual(["@anthropic-ai/sdk"]);
  });

  it("rejects @/ as scoped package (empty scope)", () => {
    const result = extractImports('import x from "@/lib/auth"');
    expect(result).toEqual([]);
  });
});
