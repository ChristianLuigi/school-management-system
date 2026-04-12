INSERT INTO users (
  id,
  email,
  password_hash,
  first_name,
  last_name,
  status,
  platform_role
)
VALUES (
  '94444444-4444-4444-8444-444444444444',
  'superadmin@almac.local',
  'scrypt:55acf3d4b1c035a49fcea814cb2b8e84:65c158e636340050cae6b864b8e674588278019972fdee49a5e6a384c092512e1069a39408e812395570c96816e4c87fbd1161f95ac66d378e2cc5f38dc3d31b',
  'Platform',
  'Admin',
  'ACTIVE',
  'SUPER_ADMIN'
)
ON CONFLICT (email) DO NOTHING;