import { ForbiddenException } from '@nestjs/common';

export type SchoolRole = 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN' | 'PARENT';
export type ActorRole = 'SUPER_ADMIN' | SchoolRole;

const ROLE_GRANT_MATRIX: Record<ActorRole, readonly SchoolRole[]> = {
  SUPER_ADMIN: ['SCHOOL_ADMIN'],
  SCHOOL_ADMIN: ['TEACHER', 'FINANCE_ADMIN', 'PARENT'],
  TEACHER: [],
  FINANCE_ADMIN: [],
  PARENT: [],
};

export function assertCanGrantRole(actorRoles: ActorRole[], requestedRole: SchoolRole) {
  if (!actorRoles.some((role) => ROLE_GRANT_MATRIX[role].includes(requestedRole))) {
    throw new ForbiddenException('You are not allowed to grant this role.');
  }
}
