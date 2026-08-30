# Remaining Checklist

## Critical (must fix before selling)

| Item | Files | Risk | Effort | Suggested commit |
|---|---|---|---|---|
| Ensure customer package is built from a fresh repo without original Git history | [scripts/strip-client-app.sh](../scripts/strip-client-app.sh), [scripts/verify-client-branch.mjs](../scripts/verify-client-branch.mjs) | High | Medium | `chore: enforce fresh-client-delivery repo creation` |
| Remediate module-scope secret reads | [src/lib/storage.server.ts](../src/lib/storage.server.ts) and related env-loading modules | High | Medium | `fix: move secret reads into runtime-bound functions` |
| Verify final live customer deployment on clean environment | all deployment docs and release workflow | High | High | `ci: add clean-release validation gate` |

## High priority

| Item | Files | Risk | Effort | Suggested commit |
|---|---|---|---|---|
| Add release tagging and semantic versioning enforcement | repo workflows and release docs | Medium | Low | `chore: add versioned release tags` |
| Formalize build fingerprint validation on server | [src/lib/adapters/licence-runtime.ts](../src/lib/adapters/licence-runtime.ts) | Medium | Medium | `fix: verify customer and release identifiers` |
| Extend live security tests to deployment checks | [tests](../tests) | Medium | Medium | `test: add release hardening regression tests` |

## Medium priority

| Item | Files | Risk | Effort | Suggested commit |
|---|---|---|---|---|
| Add capacity benchmarking | [docs/capacity-report.md](capacity-report.md) | Medium | Medium | `docs: add production capacity model` |
| Improve release pipeline visibility | [.github/workflows](../.github/workflows) | Medium | Low | `ci: improve release observability` |
| Document incident response and rollback | [docs/disaster-recovery.md](disaster-recovery.md) | Medium | Low | `docs: add rollback playbooks` |

## Low priority

| Item | Files | Risk | Effort | Suggested commit |
|---|---|---|---|---|
| Clean documentation duplication between docs and README | [README.md](../README.md), [docs](.) | Low | Low | `docs: streamline project documentation` |
| Add finer-grained branch retirement policy | [docs/branching.md](branching.md) | Low | Low | `docs: define branch lifecycle rules` |

## Summary

The repo has a solid foundation but still needs hard, evidence-backed operational controls before calling it enterprise-grade production ready.
