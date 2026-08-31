# Audit CI Scope — why some stages stay NOT_VERIFIED in CI

The audit pipeline (`scripts/audit/p00…p20`) is evidence-gated: a stage reports
`PASS` only when a real tool ran and produced a JSON artifact. When a tool or
credential is absent the stage reports `NOT_VERIFIED` (exit 2). It never
fabricates a result.

Some stages are **deliberately** left unverified in GitHub Actions. This is a
security posture decision, not an outstanding defect.

## Stages intentionally local-only

| Stage | Why it does not run in CI |
| --- | --- |
| P09 Database Capacity | Needs a direct connection string to a real database. We do not store database credentials in CI. |
| P09b RLS Overhead | Same connection string as P09. |
| P10 RLS Correctness | Requires `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS by design. A CI-resident service-role key is a larger risk than the assurance the stage provides. Run locally with a **staging-scoped** key and `AUDIT_CONFIRM_STAGING_KEY=1`. |
| P14 Cloudflare Pages Gate | Requires a Cloudflare API token. Scope it to read-only deployment status and keep it in a local `.env` only. |
| P15 Disaster Recovery Drill | Destructive by design. Runs only against a disposable scratch database, with `AUDIT_CONFIRM_DISPOSABLE_DB=1` explicitly set. |

## Consequence for the verdict

Because those five stages never produce evidence inside CI, **CI's own verdict
caps at `CONDITIONAL_PASS`** (score ≥ 80%, zero FAIL). A full `PASS` is only
reachable on an operator machine that has run the local-only stages by hand
with a local `.env`. That ceiling is the correct reflection of the chosen
secrets policy.

## Heavy load stages

P06 (stress), P07 (spike) and P08 (soak) refuse to run unless
`AUDIT_ALLOW_HEAVY_LOAD=1` is set, even when `BASE_URL` is present. This
prevents an accidental sustained-traffic run against a shared or production
environment. Schedule them in an off-peak window against a dedicated staging
deployment you have explicitly authorised.

## Stage counting

There are **22 scripts**: P00–P20 (21) plus P09b. P20 is the aggregator and is
excluded from its own denominator, so `totalStagesAggregated` is **21**. The
canonical list lives in the `STAGES` array at the top of
`scripts/audit/p20-final-report.sh` — change it there, nowhere else.

## Running locally

```bash
# always-available stages
for s in p00 p01 p11 p16 p17 p18 p19; do bash scripts/audit/${s}-*.sh; done

# staging stages (after exporting BASE_URL)
export BASE_URL=https://staging.example.com
bash scripts/audit/p02-api-smoke.sh
bash scripts/audit/p05-autocannon-bench.sh

# aggregate
bash scripts/audit/p20-final-report.sh
```

Confirm `.env` is in `.gitignore` before putting any credential in it.
