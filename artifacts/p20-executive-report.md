# Aether AR — Audit Executive Report

- Commit: `483a294478eaea368eb9c2a6a82729c292446a87`
- Generated: 2026-09-03T04:15:40Z
- Total stages aggregated: **21** (P00–P19 plus P09b; P20 is the aggregator and is excluded from its own denominator)
- PASS: 6 · FAIL: 0 · NOT_VERIFIED: 1 · NOT RUN: 14
- Score: **28%**
- Verdict: **FAIL**

| Stage | Name | Status |
| --- | --- | --- |
| P00 | Repository Integrity | PASS |
| P01 | Build & Static Quality | PASS |
| P02 |  | MISSING |
| P03 |  | MISSING |
| P04 |  | MISSING |
| P05 |  | MISSING |
| P06 |  | MISSING |
| P07 |  | MISSING |
| P08 |  | MISSING |
| P09 |  | MISSING |
| P09B |  | MISSING |
| P10 |  | MISSING |
| P11 | Security & Abuse Controls | PASS |
| P12 |  | MISSING |
| P13 |  | MISSING |
| P14 |  | MISSING |
| P15 |  | MISSING |
| P16 | Delivery Package | PASS |
| P17 | CPU Profile & Bundle Treemap | PASS |
| P18 | Supply Chain Audit | NOT_VERIFIED |
| P19 | Contract Alignment | PASS |

Verdict rule: PASS requires 100% PASS with zero FAIL and zero NOT_VERIFIED.
CONDITIONAL_PASS requires score ≥ 80% with zero FAIL. Anything else is FAIL.

Stages that stay NOT_VERIFIED in CI by design are documented in docs/audit-ci-scope.md.
