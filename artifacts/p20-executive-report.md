# Aether AR — Audit Executive Report

- Commit: `d6809877861c2e45e7ba5ca893869582807efd72`
- Generated: 2026-09-03T04:13:29Z
- Total stages aggregated: **21** (P00–P19 plus P09b; P20 is the aggregator and is excluded from its own denominator)
- PASS: 4 · FAIL: 1 · NOT_VERIFIED: 1 · NOT RUN: 15
- Score: **19%**
- Verdict: **FAIL**

| Stage | Name | Status |
| --- | --- | --- |
| P00 |  | MISSING |
| P01 | Build & Static Quality | FAIL |
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
