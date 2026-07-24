import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'required_school_roles';

export type SchoolRole = 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN';

export const Roles = (...roles: SchoolRole[]) => SetMetadata(ROLES_KEY, roles);
