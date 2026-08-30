import { createServerFn } from "@tanstack/react-start";

export type PublicDeploymentProfile = {
  kind: "admin-managed" | "admin-self-hosted" | "client-app";
  role: "admin" | "client";
  features: {
    licensing: boolean;
    approvals: boolean;
    diagnostics: boolean;
    analytics: boolean;
    catalog: boolean;
    adminMfa: boolean;
  };
};

/**
 * Branch-aware feature flags for the dashboard.
 *
 * The profile is derived from server env only (see
 * src/lib/adapters/deployment.server.ts); the browser receives the resolved
 * booleans and never the raw variables. Safe for any signed-in user: it
 * discloses which build this is, not who may use it — every admin surface
 * still re-verifies the caller's role server-side.
 */
export const getDeploymentProfile = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicDeploymentProfile> => {
    const { deploymentProfile } = await import("@/lib/adapters/deployment.server");
    const p = deploymentProfile();
    return { kind: p.kind, role: p.role, features: p.features };
  },
);
