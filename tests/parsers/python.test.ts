import { describe, it, expect } from "vitest";
import { extractImports } from "../../src/parsers/python.js";

describe("Python parser", () => {
  it("extracts a simple import", () => {
    const result = extractImports('import numpy');
    expect(result.map((r) => r.packageName)).toEqual(["numpy"]);
  });

  it("extracts from-import and aliased import, normalizing to top-level", () => {
    const result = extractImports('from foo.bar import x\nimport baz as b');
    expect(result.map((r) => r.packageName)).toEqual(["foo", "baz"]);
  });

  it("skips relative imports", () => {
    const result = extractImports('from . import local\nfrom .sibling import x');
    expect(result).toEqual([]);
  });

  it("skips stdlib modules", () => {
    const result = extractImports('import os\nimport json');
    expect(result).toEqual([]);
  });

  it("returns empty for empty file", () => {
    const result = extractImports("");
    expect(result).toEqual([]);
  });
});
