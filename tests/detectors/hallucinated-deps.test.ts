import { describe, it, expect, vi, beforeEach } from "vitest";
import { hallucinatedDeps } from "../../src/detectors/hallucinated-deps.js";
import type { DetectorContext } from "../../src/types.js";

// Mock registry clients
vi.mock("../../src/registries/pypi.js", () => ({
  exists: vi.fn(),
}));

vi.mock("../../src/registries/npm.js", () => ({
  exists: vi.fn(),
}));

import * as pypi from "../../src/registries/pypi.js";
import * as npm from "../../src/registries/npm.js";

const pypiExists = vi.mocked(pypi.exists);
const npmExists = vi.mocked(npm.exists);

describe("Hallucinated Dependencies Detector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 detections when all packages exist", async () => {
    pypiExists.mockResolvedValue(true);

    const ctx: DetectorContext = {
      filePath: "app.py",
      content: "import numpy\nimport pandas",
      language: "python",
    };

    const detections = await hallucinatedDeps.run(ctx);
    expect(detections).toHaveLength(0);
  });

  it("returns 1 detection for a missing package with correct line number", async () => {
    pypiExists.mockImplementation(async (name: string) => {
      return name !== "fake_pkg";
    });

    const ctx: DetectorContext = {
      filePath: "app.py",
      content: "import numpy\nimport fake_pkg",
      language: "python",
    };

    const detections = await hallucinatedDeps.run(ctx);
    expect(detections).toHaveLength(1);
    expect(detections[0]!.line).toBe(2);
    expect(detections[0]!.message).toContain("fake_pkg");
    expect(detections[0]!.severity).toBe("critical");
  });

  it("returns multiple detections for multiple missing packages", async () => {
    pypiExists.mockImplementation(async (name: string) => {
      return name === "numpy";
    });

    const ctx: DetectorContext = {
      filePath: "app.py",
      content: "import numpy\nimport fake_a\nimport fake_b",
      language: "python",
    };

    const detections = await hallucinatedDeps.run(ctx);
    expect(detections).toHaveLength(2);
  });

  it("throws on registry timeout", async () => {
    pypiExists.mockRejectedValue(new Error("PyPI request timed out"));

    const ctx: DetectorContext = {
      filePath: "app.py",
      content: "import some_pkg",
      language: "python",
    };

    await expect(hallucinatedDeps.run(ctx)).rejects.toThrow("timed out");
  });
});

// ---------------------------------------------------------------------------
// v0.6.1 regression — path aliases must NEVER trigger hallucinated-deps
// ---------------------------------------------------------------------------

describe("hallucinated-deps: path aliases must NOT trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // If any specifier leaks through to registry, fail it so the test catches FPs
    npmExists.mockResolvedValue(false);
    pypiExists.mockResolvedValue(false);
  });

  const jsCases: [string, string][] = [
    // Next.js / Vite / CRA path alias
    ['import { auth } from "@/lib/auth";', "Next.js @/ alias"],
    ['import HomeScreen from "@/components/HomeScreen";', "Next.js @/components alias"],
    ['import x from "@/utils/x";', "generic @/ alias"],
    // Nuxt ~/
    ['import x from "~/composables/useX";', "Nuxt ~/ alias"],
    // Node subpath imports #/
    ['import x from "#/internal/x";', "Node #/ subpath"],
    // Bare # subpath imports
    ['import x from "#internal/x";', "Node # subpath (bare)"],
    // UmiJS @@/
    ['import x from "@@/plugin-foo";', "UmiJS @@/ alias"],
    // Relative
    ['import x from "./foo";', "relative ./"],
    ['import x from "../bar/baz";', "relative ../"],
    // Node built-ins
    ['import fs from "node:fs/promises";', "node: builtin"],
    ['import path from "path";', "bare node builtin"],
    // Absolute path
    ['import x from "/absolute/path";', "absolute path /"],
  ];

  for (const [code, label] of jsCases) {
    it(`JS/TS — does not flag: ${label}`, async () => {
      const ctx: DetectorContext = {
        filePath: "app.tsx",
        content: code,
        language: "typescript",
      };
      const d = await hallucinatedDeps.run(ctx);
      expect(d.filter(f => f.detector === "hallucinated-deps")).toHaveLength(0);
    });
  }

  const pyCases: [string, string][] = [
    ["from .foo import bar", "relative from ."],
    ["from ..utils import helper", "relative from .."],
    ["from .models.user import User", "relative from .models"],
  ];

  for (const [code, label] of pyCases) {
    it(`Python — does not flag: ${label}`, async () => {
      const ctx: DetectorContext = {
        filePath: "app.py",
        content: code,
        language: "python",
      };
      const d = await hallucinatedDeps.run(ctx);
      expect(d.filter(f => f.detector === "hallucinated-deps")).toHaveLength(0);
    });
  }
});

describe("hallucinated-deps: real scoped packages still detected when suspicious", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("still flags unknown scoped package not on npm", async () => {
    npmExists.mockResolvedValue(false);
    const ctx: DetectorContext = {
      filePath: "app.ts",
      content: 'import x from "@anthropic/sdk";',
      language: "typescript",
    };
    const d = await hallucinatedDeps.run(ctx);
    expect(d.some(f => f.detector === "hallucinated-deps")).toBe(true);
  });

  it("does NOT flag known-good scoped package", async () => {
    npmExists.mockResolvedValue(true);
    const ctx: DetectorContext = {
      filePath: "app.ts",
      content: 'import x from "@anthropic-ai/sdk";',
      language: "typescript",
    };
    const d = await hallucinatedDeps.run(ctx);
    expect(d.filter(f => f.detector === "hallucinated-deps")).toHaveLength(0);
  });
});

describe("hallucinated-deps: Next.js page.tsx acceptance test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    npmExists.mockResolvedValue(false);
  });

  it("canonical Next.js page.tsx with @/ aliases → 0 findings", async () => {
    const ctx: DetectorContext = {
      filePath: "app/page.tsx",
      content: [
        'import { auth } from "@/lib/auth";',
        'import HomeScreen from "@/components/HomeScreen";',
        'import { db } from "@/lib/db";',
        'import styles from "./page.module.css";',
      ].join("\n"),
      language: "typescript",
    };
    const d = await hallucinatedDeps.run(ctx);
    expect(d).toHaveLength(0);
  });
});
