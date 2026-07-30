BEGIN;

/*
 * Staff management requires an active staff-directory record in addition to
 * an active SCHOOL_ADMIN membership. Older platform provisioning created the
 * account, membership, and role without that final link. Repair only genuinely
 * missing records; do not reactivate existing suspended or terminated staff.
 */
INSERT INTO school_staff_accounts (
  school_id,
  user_id,
  staff_type,
  staff_category,
  employment_status,
  hire_date,
  first_name,
  last_name,
  email_original,
  email_normalized
)
SELECT DISTINCT ON (
  membership.school_id,
  membership.user_id
)
  membership.school_id,
  membership.user_id,
  'SCHOOL_ADMIN',
  'SCHOOL_LEADERSHIP',
  'ACTIVE',
  CURRENT_DATE,
  NULLIF(BTRIM(usr.first_name), ''),
  NULLIF(BTRIM(usr.last_name), ''),
  COALESCE(
    NULLIF(BTRIM(usr.email_original), ''),
    NULLIF(BTRIM(usr.email::TEXT), '')
  ),
  LOWER(
    COALESCE(
      NULLIF(BTRIM(usr.email_normalized), ''),
      NULLIF(BTRIM(usr.email_original), ''),
      NULLIF(BTRIM(usr.email::TEXT), '')
    )
  )
FROM school_memberships membership
JOIN school_membership_roles role
  ON role.school_membership_id = membership.id
 AND role.role::TEXT = 'SCHOOL_ADMIN'
 AND role.deleted_at IS NULL
JOIN users usr
  ON usr.id = membership.user_id
 AND usr.deleted_at IS NULL
WHERE membership.membership_status = 'ACTIVE'
  AND membership.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM school_staff_accounts staff
    WHERE staff.school_id = membership.school_id
      AND staff.user_id = membership.user_id
      AND staff.deleted_at IS NULL
  )
ORDER BY
  membership.school_id,
  membership.user_id,
  membership.activated_at DESC NULLS LAST,
  membership.created_at DESC
ON CONFLICT (
  school_id,
  user_id
)
WHERE deleted_at IS NULL
DO NOTHING;

COMMIT;