import { Request } from 'express';

export type SessionUser = {
  session_id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
  user_email: string;
  first_name: string | null;
  last_name: string | null;
  user_status: string;
  platform_role: 'SUPER_ADMIN' | null;
};

export type MembershipAccess = {
  schoolId: string;
  roles: string[];
};

export type RequestWithAuth = Request & {
  authSession?: SessionUser;
  schoolAccess?: MembershipAccess;
};

export function extractBearerToken(authHeader?: string): string {
  if (!authHeader) {
    return '';
  }

  const [scheme, token] = authHeader.split(' ');

  if (!scheme || !token) {
    return '';
  }

  if (scheme.toLowerCase() !== 'bearer') {
    return '';
  }

  return token.trim();
}
