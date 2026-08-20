/**
 * Branch-aware deployment profile.
 *
 * Every branch ships the SAME code; only env differs. This module turns the
 * raw env into one derived profile so middleware, route gates and the
 * dashboard never re-implement "am I the admin build or a client build?".
 *
 *   main         LICENCE_ROLE=issuer  RUNTIME=edge  -> admin  (managed)
 *   self-hosted  LICENCE_ROLE=issuer  RUNTIME=node  -> admin  (self-hosted)
 *   client-app   LICENCE_ROLE=client  DB_DRIVER=none -> client (customer)
 *
 * Nothing outside src/lib/adapters/** reads these variables directly.
 */
import { dbDriver, licenceRole, readEnv, runtime } from "./env.server";

export type DeploymentKind = "admin-managed" | "admin-self-hosted" | "client-app";

export type DeploymentProfile = {
  kind: DeploymentKind;
  /** "admin" builds host the licence issuer + admin dashboard. */
  role: "admin" | "client";
  runtime: "edge" | "node";
  stateless: boolean;
  features: {
    /** Licence issuing, activations, force-release. */
    licensing: boolean;
    /** Manual admin approval queue for new signups. */
    approvals: boolean;
    /** Audit log + gate diagnostics. */
    diagnostics: boolean;
    /** Scan analytics + marker testing. */
    analytics: boolean;
    /** Enforce TOTP step-up for admins. */
    adminMfa: boolean;
  };
};

function kindOf(): DeploymentKind {
  if (licenceRole() === "client" || dbDriver() === "none") return "client-app";
  return runtime() === "node" ? "admin-self-hosted" : "admin-managed";
}

export function deploymentProfile(): DeploymentProfile {
  const kind = kindOf();
  const isAdminBuild = kind !== "client-app";
  return {
    kind,
    role: isAdminBuild ? "admin" : "client",
    runtime: runtime(),
    stateless: dbDriver() === "none",
    features: {
      licensing: isAdminBuild,
      approvals: isAdminBuild,
      diagnostics: isAdminBuild,
      // A client deployment still records its own scans; it just cannot see
      // anybody else's. Opt out with FEATURE_ANALYTICS=false.
      analytics: readEnv("FEATURE_ANALYTICS") !== "false",
      adminMfa: isAdminBuild && readEnv("FEATURE_ADMIN_MFA") !== "false",
    },
  };
}
