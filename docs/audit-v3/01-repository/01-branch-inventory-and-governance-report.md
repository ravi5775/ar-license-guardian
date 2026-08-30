# 01-repository-01 — Branch inventory and governance

## Executive summary

This repository uses a deliberately segmented branch model intended to separate admin/issuer functionality from customer-facing delivery. The current repository state shows a single local branch (`main`) and multiple remote branches, including `origin/client-app`, `origin/self-hosted`, and multiple `origin/dependabot/*` branches. This is consistent with the project’s stated governance model in [docs/branching.md](../../branching.md), which defines a one-way merge pattern from `main` to `self-hosted` and `client-app`.

This is a verified, intentional design for controlled delivery. The repository does not currently have any Git tags, and the branch inventory includes dependency-maintenance branches but no feature hotfix or release branch pattern in the active branch set. That is not necessarily a defect, but it is a governance gap for formal enterprise release management.

## Evidence table

| Check | Evidence | Status |
|---|---|---|
| Branch list | `git branch -a --no-color` | VERIFIED |
| Tags | `git tag -n` | VERIFIED: none |
| Commit count | `git rev-list --count HEAD` | VERIFIED: 552 |
| Contributors | `git shortlog -sne --all` | VERIFIED |
| Merge count | `git rev-list --count --merges HEAD` | VERIFIED: 80 |
| Branch governance doc | [docs/branching.md](../../branching.md) | VERIFIED |
| Delivery safety doc | [scripts/strip-client-app.sh](../../scripts/strip-client-app.sh) | VERIFIED |
| Release workflow | [.github/workflows/release-client-app.yml](../../.github/workflows/release-client-app.yml) | VERIFIED |

## Verified findings

1. The repository has a clear branch separation strategy.
   - Evidence: [docs/branching.md](../../branching.md) states:
     - `main` = admin / issuer
     - `self-hosted` = admin / private server
     - `client-app` = shipped to customers
   - This matches the actual branch list from Git.

2. The branch model is one-way and controlled.
   - Evidence: [docs/branching.md](../../branching.md) explicitly says:
     - `main ──> self-hosted`
     - `main ──> client-app`
     - no merge back from customer or self-hosted branches to main

3. The customer branch is intentionally stripped.
   - Evidence: [scripts/strip-client-app.sh](../../scripts/strip-client-app.sh) deletes issuer/admin code and internal workflows before customer delivery.

4. The repository currently has no tags.
   - Evidence: `git tag -n` returned no output.
   - This is a gap for semantic release discipline and traceable production tagging.

5. The repository has many dependency-management branches but no obvious release/hotfix branch model in the active branch set.
   - Evidence: `git branch -a --no-color` showed `origin/dependabot/*` branches and shipping branches, but no `release/*` or `hotfix/*` branch pattern.

## Risk rating

Medium

Reason:
- The branch model is intentional and well-documented.
- The main governance risk is not branch count but lack of formal release tagging and a standardized release/hotfix process in the active repo state.

## Recommended fix

1. Add formal release branch policy and naming conventions (`release/*`, `hotfix/*`) if the project intends enterprise-grade governance.
2. Add semantic version tags for production artifacts.
3. Require protected-branch controls in GitHub for `main`, `self-hosted`, and `client-app`.
4. Add branch lifecycle policy documentation in [docs/branching.md](../../branching.md).

## Suggested commit message

`chore: add release and hotfix governance for enterprise branch policy`

## Production readiness impact

Moderate. The codebase architecture is sound, but enterprise procurement typically expects explicit release governance, tag policy, and branch protection controls before production acceptance.

## Verification commands

```bash
git branch -a --no-color
git tag -n
git rev-list --count HEAD
git shortlog -sne --all
git rev-list --count --merges HEAD
```

## Missing evidence / NOT VERIFIED

- No verified GitHub branch protection settings were inspected in this session.
- No formal release policy document for `release/*` or `hotfix/*` was found in the active repo structure.
- No signed-tag or release-signing enforcement was verified.

## Final assessment

This repository is structured in a governance-aware way and uses a branch strategy that is appropriate for controlled customer distribution. The strongest indicator is the explicit separation documented in [docs/branching.md](../../branching.md). The main remaining enterprise gap is formal release governance and tag-based release controls.
