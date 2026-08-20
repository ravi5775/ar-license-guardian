/** HTML-escape any untrusted value before interpolating it into email HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type DuplicateFingerprintAlert = {
  license_key: string;
  client_name?: string | null;
  client_email?: string | null;
  attempted_fingerprint: string;
  attempted_domain?: string | null;
  ip?: string | null;
};

/**
 * Vendor alert for a rejected activation.
 *
 * SERVER-ONLY on purpose. This used to be exposed as a server function, which
 * meant any anonymous caller could trigger an outbound email — an inbox-flood
 * and sender-reputation vector. It is now only reachable from the licence
 * activation route, after that route's own rate limiting and validation.
 *
 * Never throws: failing to alert must not fail an activation response.
 */
export async function sendDuplicateFingerprintAlert(
  data: DuplicateFingerprintAlert,
): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  const from =
    process.env.ALERT_FROM_EMAIL || "Aether AR <onboarding@resend.dev>";
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

    const res = await fetch(
      "https://connector-gateway.lovable.dev/resend/emails",
      {
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
      },
    );
    if (!res.ok) {
      console.error("[notify] resend failed", res.status, await res.text());
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("[notify] error", err);
    return { ok: false };
  }
}
