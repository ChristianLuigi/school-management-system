INSERT INTO school_membership_roles (
  school_membership_id,
  role
)
SELECT
  sm.id,
  sur.role::text::school_staff_role
FROM school_user_roles sur
JOIN school_memberships sm
  ON sm.school_id = sur.school_id
 AND sm.user_id = sur.user_id
WHERE sur.deleted_at IS NULL
  AND sm.deleted_at IS NULL
  AND sur.role::text IN ('SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN')
ON CONFLICT DO NOTHING;