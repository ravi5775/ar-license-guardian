# Branch Analysis

## Verified branch inventory

| Branch | Verified purpose | Safe to keep | Notes |
|---|---|---|---|
| `main` | admin / issuer platform | Yes | This is the highest-risk branch for customer distribution |
| `origin/main` | Git remote mirror | Yes | Synced to local `main` |
| `origin/client-app` | customer-facing branch | Yes, but only in stripped form or recreated fresh | This branch is intentionally simplified |
| `origin/self-hosted` | private admin branch for Docker/self-hosted deployment | Yes | Enterprise/private installation branch |
| `origin/dependabot/*` | dependency upgrade branches | Yes | Usually safe and disposable by policy |

## Count summary

- Local branches: 1
- Remote tracking branches: 19
- Total branch refs: 20

## Why the branch model exists

The branch structure is consistent with the repo docs and delivery rules:
- `main` remains the issuer/admin environment.
- `self-hosted` is a deployment variant for private admin operations.
- `client-app` is the stripped customer branch created by deleting issuer/admin artifacts.

This is an intentional architecture and is not an accidental branch proliferation problem.

## Branch safety assessment

- `main`: must never be delivered to customers.
- `self-hosted`: enterprise admin only; use with separate operational controls.
- `client-app`: safe only when shipped from a fresh repository created after stripping and verification.
- `dependabot/*`: not part of delivery logic.

## Final note

The repo is intentionally branch-divided, and this structure is a core operational control. The real risk is not the branches themselves, but how they are packaged and distributed.
