# Data Processing Agreement (DPA) — Aether AR

> **⚠️ PLACEHOLDER — NOT LEGAL ADVICE**
>
> India's DPDP Act 2023 is in effect. If the Client serves EU users, GDPR
> also applies. Have this reviewed by counsel before signing. It auto-
> terminates at handover; from that point the Client is sole controller.

---

## 1. Scope

This DPA applies to the **pre-handover build and test window** during
which Vendor may incidentally process personal data (photos, names,
emails) provided by Client for the purpose of building, configuring, and
QA'ing the Aether AR deployment.

## 2. Roles

- Client: **Data Controller** (both DPDP Act "Data Fiduciary" and GDPR
  "Controller")
- Vendor: **Data Processor** for the duration of pre-handover work only

## 3. Vendor obligations

a. Process personal data only on Client's documented instructions;
b. Ensure personnel with access are under confidentiality;
c. Apply reasonable technical and organizational security measures
   (encryption in transit and at rest, access controls, backups);
d. Assist Client with data subject requests to the extent reasonable;
e. Notify Client of any personal data breach within 48 hours of
   discovery;
f. On handover, delete or return all personal data unless otherwise
   agreed in writing.

## 4. Sub-processors

Vendor uses:

- Lovable Cloud (Supabase) — database, auth, storage (EU / US regions
  per Client's selection)
- Cloudflare — CDN, DNS, edge compute
- Resend — transactional email (optional)
- Sentry — error monitoring (optional, no PII by default)

Client consents to these sub-processors. Vendor will notify Client 30
days before adding any new sub-processor.

## 5. Data categories & retention

Only what Client uploads: photos, videos, marker images, user names, user
emails, session tokens. Retention during build window ≤ 90 days.

## 6. NO biometric processing

Vendor does **not** perform facial recognition, gait analysis, or any
other biometric identification. AR tracking uses **image markers only**
(feature-point matching, no person identification).

## 7. Auto-termination

This DPA terminates automatically on handover completion. From that
point the Client is sole controller AND sole processor; Vendor has no
further access.

---

**Signed by**

Vendor: ______________________  Date: ____________

Client: ______________________  Date: ____________
