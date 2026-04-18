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
