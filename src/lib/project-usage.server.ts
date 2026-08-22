/**
 * ============================================================================
 * AETHER AR — Bandwidth & Egress Accounting System
 * ============================================================================
 * Tracks monthly egress bandwidth per project upon presign URL generation.
 * Enforces:
 *   - Soft warning alert email at 80% quota utilization.
 *   - Hard block returning `QUOTA_EXCEEDED` at 100% utilization.
 * ============================================================================
 */

import { sendMail } from "./adapters/mailer.server";
import { readEnv } from "./adapters/env.server";

export interface EgressCheckResult {
  allowed: boolean;
  usedBytes: number;
  capBytes: number;
  percent: number;
  status: "ok" | "warn_80" | "exceeded";
}

function currentMonthYear(): string {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Checks and records egress usage for a project during presign generation.
 * Default estimated payload size for an AR video fetch is 5MB (5,242,880 bytes).
 */
export async function accountEgress(
  projectId: string,
  estimatedBytes = 5 * 1024 * 1024
): Promise<EgressCheckResult> {
  if (!projectId) {
    return { allowed: true, usedBytes: 0, capBytes: 0, percent: 0, status: "ok" };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const monthYear = currentMonthYear();

  // 1. Fetch current monthly usage row
  const { data: usage } = await supabaseAdmin
    .from("project_usage")
    .select("id, egress_bytes, egress_cap_bytes, warning_80_notified_at")
    .eq("project_id", projectId)
    .eq("month_year", monthYear)
    .maybeSingle();

  const currentBytes = Number(usage?.egress_bytes ?? 0);
  const capBytes = Number(usage?.egress_cap_bytes ?? 100 * 1024 * 1024 * 1024); // 100 GB default
  const newBytes = currentBytes + estimatedBytes;
  const percent = (newBytes / capBytes) * 100;

  // 2. Check 100% Hard Stop
  if (currentBytes >= capBytes) {
    return {
      allowed: false,
      usedBytes: currentBytes,
      capBytes,
      percent: (currentBytes / capBytes) * 100,
      status: "exceeded",
    };
  }

  // 3. Upsert incremented usage
  await supabaseAdmin.from("project_usage").upsert(
    {
      project_id: projectId,
      month_year: monthYear,
      egress_bytes: newBytes,
      egress_cap_bytes: capBytes,
      request_count: 1, // trigger or default increment
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,month_year" }
  );

  // 4. Soft Warning at 80%
  if (percent >= 80 && !usage?.warning_80_notified_at) {
    await supabaseAdmin
      .from("project_usage")
      .update({ warning_80_notified_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("month_year", monthYear);

    const alertEmail = readEnv("ALERT_TO_EMAIL") || "admin@aether-ar.local";
    try {
      await sendMail({
        to: alertEmail,
        subject: `⚠️ [Aether AR Quota Warning] Project bandwidth at ${percent.toFixed(1)}%`,
        html: `
          <h3>Bandwidth Quota Warning</h3>
          <p>Project <code>${projectId}</code> has reached <strong>${percent.toFixed(1)}%</strong> of its monthly bandwidth allowance (${(newBytes / 1024 / 1024 / 1024).toFixed(2)} GB / ${(capBytes / 1024 / 1024 / 1024).toFixed(2)} GB) for <strong>${monthYear}</strong>.</p>
          <p>Access will be paused automatically if 100% is reached.</p>
        `,
      });
    } catch {
      // Non-blocking alert failure
    }

    return {
      allowed: true,
      usedBytes: newBytes,
      capBytes,
      percent,
      status: "warn_80",
    };
  }

  return {
    allowed: true,
    usedBytes: newBytes,
    capBytes,
    percent,
    status: "ok",
  };
}

/**
 * Summarizes usage for all projects for the admin dashboard.
 */
export async function getAdminUsageSummary() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const monthYear = currentMonthYear();

  const { data: usageList } = await supabaseAdmin
    .from("project_usage")
    .select("project_id, egress_bytes, egress_cap_bytes, request_count, month_year, projects(title, owner_id)")
    .eq("month_year", monthYear);

  return (usageList ?? []).map((u: any) => ({
    projectId: u.project_id,
    projectTitle: u.projects?.title ?? "Untitled Project",
    monthYear: u.month_year,
    usedGB: (Number(u.egress_bytes) / 1024 / 1024 / 1024).toFixed(2),
    capGB: (Number(u.egress_cap_bytes) / 1024 / 1024 / 1024).toFixed(2),
    percentUsed: ((Number(u.egress_bytes) / Number(u.egress_cap_bytes)) * 100).toFixed(1),
    totalRequests: u.request_count,
  }));
}
