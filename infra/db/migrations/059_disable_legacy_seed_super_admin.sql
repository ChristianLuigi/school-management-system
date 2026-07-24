BEGIN;

/*
 * Migration 022 created a deterministic development super administrator.
 * Disable only the untouched legacy credential. Installations where the
 * account password was changed are intentionally left alone.
 */
UPDATE users
SET
  password_hash = 'DISABLED_LEGACY_SEED',
  account_status = 'SUSPENDED',
  authentication_version = authentication_version + 1,
  updated_at = NOW()
WHERE id = '94444444-4444-4444-8444-444444444444'
  AND email_normalized = 'superadmin@almac.local'
  AND password_hash =
    'scrypt:55acf3d4b1c035a49fcea814cb2b8e84:65c158e636340050cae6b864b8e674588278019972fdee49a5e6a384c092512e1069a39408e812395570c96816e4c87fbd1161f95ac66d378e2cc5f38dc3d31b';

UPDATE auth_sessions
SET
  revoked_at = COALESCE(revoked_at, NOW()),
  revocation_reason = COALESCE(
    revocation_reason,
    'LEGACY_SEED_ACCOUNT_DISABLED'
  ),
  updated_at = NOW()
WHERE user_id = '94444444-4444-4444-8444-444444444444'
  AND revoked_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM users
    WHERE id = '94444444-4444-4444-8444-444444444444'
      AND email_normalized = 'superadmin@almac.local'
      AND password_hash = 'DISABLED_LEGACY_SEED'
  );

COMMIT;
