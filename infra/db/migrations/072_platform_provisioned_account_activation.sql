BEGIN;

/*
 * Direct platform provisioning predates the secure account columns introduced
 * by migration 054. Those users received active memberships and passwords, but
 * their normalized email and verified account state were left empty. Repair
 * only directly provisioned active staff accounts. Invitation-created users
 * are activated by the invitation workflow and do not match this predicate.
 */
UPDATE auth_sessions session
SET
  revoked_at = COALESCE(session.revoked_at, NOW()),
  revocation_reason = COALESCE(
    session.revocation_reason,
    'PLATFORM_ACCOUNT_ACTIVATED'
  ),
  updated_at = NOW()
WHERE session.revoked_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM users usr
    JOIN school_memberships membership
      ON membership.user_id = usr.id
     AND membership.membership_status = 'ACTIVE'
     AND membership.deleted_at IS NULL
    JOIN school_membership_roles role
      ON role.school_membership_id = membership.id
     AND role.role::TEXT IN (
       'SCHOOL_ADMIN',
       'TEACHER',
       'FINANCE_ADMIN'
     )
     AND role.deleted_at IS NULL
    WHERE usr.id = session.user_id
      AND usr.deleted_at IS NULL
      AND usr.status::TEXT = 'ACTIVE'
      AND usr.password_hash IS NOT NULL
      AND (
        NULLIF(BTRIM(usr.email_normalized), '') IS NULL
        OR usr.account_status = 'PENDING_VERIFICATION'
        OR usr.email_verified_at IS NULL
      )
  );

UPDATE users usr
SET
  email_original = COALESCE(
    NULLIF(BTRIM(usr.email_original), ''),
    NULLIF(BTRIM(usr.email::TEXT), '')
  ),
  email_normalized = LOWER(
    COALESCE(
      NULLIF(BTRIM(usr.email_normalized), ''),
      NULLIF(BTRIM(usr.email_original), ''),
      NULLIF(BTRIM(usr.email::TEXT), '')
    )
  ),
  account_status = 'ACTIVE',
  email_verified_at = COALESCE(
    usr.email_verified_at,
    NOW()
  ),
  password_changed_at = COALESCE(
    usr.password_changed_at,
    NOW()
  ),
  failed_login_count = 0,
  locked_until = NULL,
  authentication_version =
    usr.authentication_version + 1,
  updated_at = NOW()
WHERE usr.deleted_at IS NULL
  AND usr.status::TEXT = 'ACTIVE'
  AND usr.password_hash IS NOT NULL
  AND (
    NULLIF(BTRIM(usr.email_normalized), '') IS NULL
    OR usr.account_status = 'PENDING_VERIFICATION'
    OR usr.email_verified_at IS NULL
  )
  AND EXISTS (
    SELECT 1
    FROM school_memberships membership
    JOIN school_membership_roles role
      ON role.school_membership_id = membership.id
     AND role.role::TEXT IN (
       'SCHOOL_ADMIN',
       'TEACHER',
       'FINANCE_ADMIN'
     )
     AND role.deleted_at IS NULL
    WHERE membership.user_id = usr.id
      AND membership.membership_status = 'ACTIVE'
      AND membership.deleted_at IS NULL
  );

COMMIT;