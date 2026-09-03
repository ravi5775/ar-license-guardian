# 55 Docker and Self-hosted Security

## Status
PARTIAL

## Blueprint Requirement
"The customer deployment must not contain ... unrestricted storage credentials" and operational deployments must be recoverable.

## Repository Evidence
- Deployment: `deploy/self-hosted/Dockerfile`, `deploy/self-hosted/docker-compose.yml`, `deploy/self-hosted/nginx.conf`
- Schema: `deploy/self-hosted/schema-selfhosted.sql`
- Workflow: `.github/workflows/deploy-self-hosted.yml`

## Findings
A self-hosted Docker deployment, local-only database binding, health-related dependencies, and backup service are present. Image pinning, container hardening, non-root execution, network isolation, and image scanning are not fully verified.

## Risk
High

## Fix Required
Pin immutable image digests, run least-privileged containers, add read-only filesystems/capabilities policy, and scan images in CI.

## Suggested Commit
`ci: harden and scan self-hosted containers`
