# Disaster recovery runbook

Scope: the managed Aether AR instance. Self-hosted client instances follow
`deploy/self-hosted/` instead — their data is their responsibility, and the
Source License Agreement says so.

## What must survive

| Asset | Where it lives | Recoverable from |
| --- | --- | --- |
| Postgres (albums, experiences, licences, audit log) | Lovable Cloud backend | Point-in-time recovery |
| Uploaded photos, films, `.mind` targets | `ar-media` bucket | Bucket copy (see below) |
| PIN hashes | Postgres, bcrypt | **Not recoverable** — re-issue |
| QR access tokens | Postgres, SHA-256 | **Not recoverable** — re-issue |
| Server secrets | Backend secret store | Password manager copy |

Two of those are deliberately unrecoverable. A restore that predates a PIN
rotation leaves printed cards dead. Re-issue the PIN and reprint — there is no
way around this, and it is the correct trade for not storing PINs reversibly.

## RPO / RTO — state these honestly to clients

- **Database RPO:** as good as the backend's point-in-time recovery window.
  **Confirm the current retention before quoting a number to a client.** Do not
  promise a window that has not been checked in the backend settings.
- **Storage RPO:** equal to the age of the last bucket copy. There is no
  automatic bucket versioning; if no copy has been taken, storage RPO is
  *infinite* — a deleted object is gone.
- **Realistic RTO:** 2-4 hours for a database restore, plus however long it
  takes to re-upload storage. Do not quote sub-hour recovery.

## Restore procedure

1. **Freeze writes.** Unpublish affected albums so clients do not scan into a
   half-restored state and generate support calls.
2. **Restore the database** to the chosen timestamp from the backend's
   point-in-time recovery. Pick a timestamp *before* the incident, not before
   the discovery.
3. **Reconcile storage against the database.** After a rollback, rows can
   reference objects uploaded after the restore point (fine, the object still
   exists) or objects can exist with no row (orphans). Find orphans:
   ```sql
   -- rows whose file is missing
   SELECT id, slug, media_path FROM ar_experiences e
    WHERE media_path IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM media_objects m
                       WHERE m.storage_path = e.media_path);
   ```
4. **Re-issue credentials for every restricted item** whose `pin_created_at` is
   newer than the restore point. Those cards are dead; the client needs new
   ones.
5. **Verify before unfreezing:** one public album scans end-to-end, one
   restricted album unlocks by PIN, one QR link auto-unlocks, admin login works
   with TOTP.
6. **Write the incident up** in `audit_log` and tell affected clients what
   window of data was lost. Do not quietly restore.

## Quarterly test restore — non-negotiable

An untested backup is a rumour. Once a quarter:

1. Restore to a scratch project.
2. Run `tests/rls-regression.test.ts` against it.
3. Scan one real album end-to-end from the restored data.
4. Record the date and the measured RTO in the table below.

| Date | Restore RTO | Result | Notes |
| --- | --- | --- | --- |
| _(never run)_ | — | — | **First test restore is outstanding.** |

Leave that row until a real test has been run. An empty log is accurate; a
fabricated one is worse than no log.
