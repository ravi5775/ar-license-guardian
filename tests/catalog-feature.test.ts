import { describe, expect, it } from "vitest";
import { deploymentProfile } from "@/lib/adapters/deployment.server";

describe("Catalog feature flag", () => {
  it("enables room catalog support by default in all deployments", () => {
    expect(deploymentProfile().features.catalog).toBe(true);
  });
});
