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
