-- Create default levels for the demo school
INSERT INTO school_levels (
  id,
  school_id,
  code,
  name_i18n,
  display_order,
  is_active
)
SELECT
  defaults.id::uuid,
  defaults.school_id::uuid,
  defaults.code,
  defaults.name_i18n,
  defaults.display_order,
  defaults.is_active
FROM (
VALUES
(
  '91111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'KG',
  '{"fr":"Maternelle","en":"Kindergarten"}'::jsonb,
  1,
  TRUE
),
(
  '92222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'PRIM',
  '{"fr":"Fondamental","en":"Primary"}'::jsonb,
  2,
  TRUE
),
(
  '93333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'SEC',
  '{"fr":"Secondaire","en":"Secondary"}'::jsonb,
  3,
  TRUE
)
) AS defaults(
  id,
  school_id,
  code,
  name_i18n,
  display_order,
  is_active
)
JOIN schools school
  ON school.id = defaults.school_id::uuid
ON CONFLICT DO NOTHING;

-- Link existing demo grade levels to Secondary
UPDATE grade_levels
SET school_level_id = '93333333-3333-4333-8333-333333333333'
WHERE school_id = '11111111-1111-4111-8111-111111111111'
  AND code IN ('6EME', '5EME', '4EME')
  AND deleted_at IS NULL;