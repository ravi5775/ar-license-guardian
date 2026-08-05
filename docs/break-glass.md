# Admin break-glass runbook

The problem this solves: TOTP is mandatory for admins. One admin account plus
one lost phone equals a permanently locked platform, with client weddings still
scanning against it.

## Standing requirement: two admins, always

Never operate with a single admin account. The second admin is not a
convenience — it is the only in-band recovery path that does not require
touching the database directly.

- Second admin enrolled on a **separate physical device**.
- Both admins enrol TOTP at `/mfa`.
- Recovery codes printed and stored **offline** (a sealed envelope in a safe),
  not in the same password manager as the primary credentials. A recovery code
  stored next to the password protects against nothing.

## Verify the current state

```sql
SELECT p.email, p.approval_status, ur.role
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
 WHERE ur.role = 'admin';
```

Fewer than two rows means the standing requirement is not met. Fix it before
anything else.

## Break-glass: promoting a second admin when nobody can log in

This requires direct database access via the backend's SQL access, which is
outside the app's auth entirely — that is the point, and also why it must be
audited.

```sql
-- 1. Find the user who should be promoted.
SELECT id, email FROM public.profiles WHERE email = 'person@example.com';

-- 2. Approve them (the approval trigger grants 'editor' and issues a licence).
UPDATE public.profiles SET approval_status = 'approved' WHERE id = '<uuid>';

-- 3. Grant admin.
INSERT INTO public.user_roles (user_id, role)
VALUES ('<uuid>', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. ALWAYS log it. Break-glass without a record is indistinguishable
--    from a compromise.
INSERT INTO public.audit_log (actor_id, action, target_type, target_id, metadata)
VALUES ('<uuid>', 'admin.break_glass', 'user', '<uuid>',
        jsonb_build_object('reason', 'lost TOTP device',
                           'authorised_by', '<name>',
                           'at', now()));
```

## Resetting a lost TOTP factor

TOTP factors live in the auth system, not in `public`. Clearing a factor is an
auth-level operation performed by the *other* admin from `/mfa`, not by editing
tables. Do not attempt to delete rows from auth schema tables — that is
unsupported and can corrupt the account.

If both admins have lost their factor and no recovery code survives, the
account is unrecoverable through the app. The break-glass promotion above,
against a fresh account, is the remaining route.

## After every break-glass use

1. Confirm the `audit_log` entry exists and is accurate.
2. Re-enrol TOTP on the recovered account.
3. Reprint and re-store offline recovery codes.
4. Demote any temporary admin created during the incident:
   ```sql
   DELETE FROM public.user_roles WHERE user_id = '<uuid>' AND role = 'admin';
   ```
5. Review `audit_log` for the incident window — a break-glass event is exactly
   when an attacker would hide other changes.
