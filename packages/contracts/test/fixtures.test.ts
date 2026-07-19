import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  contractSchemas,
  isReelSpec,
  validateContract,
  type ContractName,
} from "../src/index.js";

type FixtureManifest = {
  schema_version: "fixture-manifest.v1";
  fixtures: Array<{ schema: ContractName; path: string }>;
};

const testDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(testDirectory, "..", "..", "fixtures");
const manifest = JSON.parse(
  readFileSync(resolve(fixtureRoot, "manifest.json"), "utf8"),
) as FixtureManifest;

function fixture(path: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureRoot, path), "utf8"));
}

describe("canonical cross-language fixtures", () => {
  for (const item of manifest.fixtures) {
    it(`validates ${item.schema}`, () => {
      const result = validateContract(item.schema, fixture(item.path));
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });
  }

  it("keeps the fixture manifest and schema registry aligned", () => {
    expect(manifest.fixtures.map((item) => item.schema).sort()).toEqual(
      Object.keys(contractSchemas).sort(),
    );
  });
});

describe("strict ReelSpec boundary", () => {
  const reelPath = manifest.fixtures.find((item) => item.schema === "reel_spec.v1")?.path;
  if (!reelPath) throw new Error("reel fixture is missing");

  it("rejects an unknown scene discriminator", () => {
    const reel = fixture(reelPath) as { scenes: Array<Record<string, unknown>> };
    reel.scenes[0].scene_type = "model_authored_component";
    reel.scenes[0].component_id = "model_authored_component";
    expect(isReelSpec(reel)).toBe(false);
  });

  it("rejects arbitrary component props", () => {
    const reel = fixture(reelPath) as { scenes: Array<Record<string, unknown>> };
    reel.scenes[0].props = { remote_url: "https://attacker.invalid/payload" };
    expect(isReelSpec(reel)).toBe(false);
  });

  it("rejects a URL where an asset ID is required", () => {
    const reel = fixture(reelPath) as { scenes: Array<Record<string, unknown>> };
    reel.scenes[0].asset_id = "https://attacker.invalid/panel.png";
    expect(isReelSpec(reel)).toBe(false);
  });
});
