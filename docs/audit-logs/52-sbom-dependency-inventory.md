# 52 SBOM and Dependency Inventory

## Status
PARTIAL

## Blueprint Requirement
"Start from a clean, reproducible checkout" and verify the release artifact.

## Repository Evidence
- Dependency manifest: `package.json`
- Lock/config: `bun.lock`, `bunfig.toml`
- Workflows: `.github/workflows/codeql.yml`, `.github/workflows/ci.yml`
- Prior evidence: `artifacts/p18-result.json`

## Findings
Dependency manifests and CodeQL workflow are present. A generated SBOM, vulnerability threshold, and archived dependency inventory for releases were not found.

## Risk
High

## Fix Required
Generate SPDX or CycloneDX SBOMs in CI, scan dependencies, set severity thresholds, and archive results per release.

## Suggested Commit
`ci: publish SBOM and dependency vulnerability reports`
