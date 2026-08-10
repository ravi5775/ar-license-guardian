/**
 * Mailer adapter — the only module allowed to know which mail vendor we use.
 *   resend  (edge / main)          HTTP API, works on Workers
 *   smtp    (self-hosted)          nodemailer against the client's own relay
 *   log     (dev)                  writes to stdout, sends nothing
 *
 * Selected by MAILER_DRIVER; falls back to `resend` when RESEND_API_KEY is set,
 * `smtp` when SMTP_URL is set, otherwise `log`.
 */
import { readEnv, requireEnv } from "./env.server";

export type MailerDriver = "resend" | "smtp" | "log";

export interface Mail {
  to: string;
  subject: string;
  html: string;
}

export function mailerDriver(): MailerDriver {
  const explicit = readEnv("MAILER_DRIVER") as MailerDriver | undefined;
  if (explicit) return explicit;
  if (readEnv("RESEND_API_KEY")) return "resend";
  if (readEnv("SMTP_URL")) return "smtp";
  return "log";
}

type Sender = (mail: Mail) => Promise<void>;

let sender: Sender | null = null;

function fromAddress() {
  return readEnv("MAIL_FROM") ?? "Aether Licensing <onboarding@resend.dev>";
}

function resendSender(): Sender {
  const key = requireEnv("RESEND_API_KEY");
  return async (mail) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(),
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
      }),
    });
    if (!res.ok) throw new Error(`resend [${res.status}]: ${await res.text()}`);
  };
}

async function smtpSender(): Promise<Sender> {
  const url = requireEnv("SMTP_URL");
  const spec = "nodemailer";
  const mod = (await import(/* @vite-ignore */ spec)) as unknown as {
    createTransport: (u: string) => {
      sendMail: (o: Record<string, unknown>) => Promise<unknown>;
    };
  };
  const transport = mod.createTransport(url);
  return async (mail) => {
    await transport.sendMail({
      from: fromAddress(),
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
    });
  };
}

function logSender(): Sender {
  return async (mail) => {
    console.info(`[mailer:log] to=${mail.to} subject=${mail.subject}`);
  };
}

async function getSender(): Promise<Sender> {
  if (sender) return sender;
  const driver = mailerDriver();
  if (driver === "resend") sender = resendSender();
  else if (driver === "smtp") sender = await smtpSender();
  else sender = logSender();
  return sender;
}

/** Never throws — a failed alert must not take down the calling request. */
export async function sendMail(mail: Mail): Promise<boolean> {
  try {
    const send = await getSender();
    await send(mail);
    return true;
  } catch (e) {
    console.error("[mailer] send failed:", e);
    return false;
  }
}

export function __setSender(fn: Sender | null) {
  sender = fn;
}
