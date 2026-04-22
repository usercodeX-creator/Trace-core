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

// ---------------------------------------------------------------------------
// v0.6.1 regression — relative Python imports must be skipped
// ---------------------------------------------------------------------------

describe("Python parser: relative import exclusions", () => {
  const relativeCases: [string, string][] = [
    ["from . import utils", "from . import"],
    ["from .models import User", "from .models"],
    ["from ..utils import helper", "from ..utils"],
    ["from ...deep.module import fn", "from ...deep"],
    ["from .models.user import User", "from .models.user"],
    ["from .foo import bar, baz", "from .foo multi-import"],
  ];

  for (const [code, label] of relativeCases) {
    it(`skips ${label}`, () => {
      const result = extractImports(code);
      expect(result).toEqual([]);
    });
  }
});
