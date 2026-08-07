import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Fire-and-forget notifier. Never throws — used from public license endpoint
// where failure to notify must not fail the caller.
export const notifyDuplicateFingerprint = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        license_key: z.string(),
        client_name: z.string().optional().nullable(),
        client_email: z.string().optional().nullable(),
        attempted_fingerprint: z.string(),
        attempted_domain: z.string().optional().nullable(),
        ip: z.string().optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;
    const from = process.env.ALERT_FROM_EMAIL || "Aether AR <onboarding@resend.dev>";
    const to = process.env.ALERT_TO_EMAIL;

    if (!apiKey || !lovableKey || !to) {
      console.log("[notify] skipped duplicate-fingerprint email (missing config)", {
        license_key: data.license_key,
      });
      return { ok: false, skipped: true };
    }

    try {
      const e = escapeHtml;
      const html = `
        <h2>License activation rejected — duplicate fingerprint</h2>
        <p>Someone tried to activate a license on a different deployment fingerprint than the one it is bound to.</p>
        <ul>
          <li><b>License:</b> ${e(data.license_key)}</li>
          <li><b>Client:</b> ${e(data.client_name ?? "unknown")} (${e(data.client_email ?? "-")})</li>
          <li><b>Attempted domain:</b> ${e(data.attempted_domain ?? "unknown")}</li>
          <li><b>Attempted fingerprint:</b> <code>${e(data.attempted_fingerprint)}</code></li>
          <li><b>IP:</b> ${e(data.ip ?? "unknown")}</li>
          <li><b>Time:</b> ${e(new Date().toISOString())}</li>
        </ul>
        <p>This is evidence of contract breach — see the audit log and license agreement §5.</p>
      `;

      const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": apiKey,
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: `⚠️ Duplicate license activation — ${data.license_key}`,
          html,
        }),
      });
      if (!res.ok) {
        console.error("[notify] resend failed", res.status, await res.text());
        return { ok: false };
      }
      return { ok: true };
    } catch (e) {
      console.error("[notify] error", e);
      return { ok: false };
    }
  });
