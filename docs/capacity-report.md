# Capacity Report

## Verified vs estimated figures

This report is intentionally conservative. Most numbers below are estimated from the architecture and repository design because no live production load test was run in this session.

### Capacity assumptions

| Metric | Verified | Estimated | Basis |
|---|---:|---:|---|
| Concurrent license activations | NOT VERIFIED | 100-500 | depends on infra and database scaling |
| Concurrent AR viewers | NOT VERIFIED | 500-2,000 | depends on media/cache architecture |
| Presign RPS | NOT VERIFIED | 100-1,000 | R2 + route design |
| Heartbeats/day | NOT VERIFIED | 50k-500k | depending on customer deployment |
| Customers | NOT VERIFIED | 1-100 | product architecture is multi-tenant but not proven at scale |
| Devices | NOT VERIFIED | 1k-50k | no live deployment telemetry |
| Activations | NOT VERIFIED | 1k-100k | design allows scale but not proven |
| Bandwidth | NOT VERIFIED | 10 GB-1 TB/mo | highly variable with media |
| Database rows | NOT VERIFIED | 10k-10M | depends on use patterns |

## Maximum safe production load

Estimated maximum safe load for a single production environment:
- Small fleet: ~500 active concurrent viewers
- Medium enterprise: ~2k concurrent users with cache and R2 scaling
- Database safely supports low-to-mid volume with proper indexing and row-level isolation

## Scaling roadmap

1. Benchmark worker endpoints and presign routes under load.
2. Add indexing for hot access patterns based on actual query plans.
3. Route high-throughput media through CDN and object store.
4. Add separate analytics and audit tables for storage growth.
5. Keep license validation stateless where possible to simplify horizontal scaling.

## Note

These values are ESTIMATED, not verified with production telemetry in this session.
