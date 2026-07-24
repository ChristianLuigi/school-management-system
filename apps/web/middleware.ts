import { getSessionCookieName } from "@/lib/auth/session-cookie";
import { NextRequest, NextResponse } from "next/server";
import { assertTrustedOrigin } from "@/lib/security/trusted-origin";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000"
).replace("://localhost:", "://127.0.0.1:");

const AUTH_SCHOOL_COOKIE_NAME =
  process.env.AUTH_SCHOOL_COOKIE_NAME ?? "school_current_id";

type ManagementMode =
  | "SELF_MANAGED"
  | "SUPERADMIN_MANAGED"
  | "HYBRID_MANAGED";

type MeContextLite = {
  isSuperAdmin: boolean;
  currentRoles: string[];
  currentSchool:
    | {
        management_mode?: ManagementMode;
      }
    | null;
};

const SCHOOL_ROUTE_ROLE_GATES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/finance", roles: ["SCHOOL_ADMIN", "FINANCE_ADMIN"] },
  { prefix: "/gradebooks", roles: ["SCHOOL_ADMIN", "TEACHER"] },
  { prefix: "/attendance", roles: ["SCHOOL_ADMIN", "TEACHER"] },
  { prefix: "/setup", roles: ["SCHOOL_ADMIN"] },
];

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/activate-account" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/api/session/") ||
    pathname.startsWith("/api/auth/invitations/inspect") ||
    pathname.startsWith("/api/auth/invitations/accept") ||
    pathname.startsWith("/api/proxy/") ||
    pathname.startsWith("/api/platform/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function hasAnyRole(currentRoles: string[], required: string[]) {
  return required.some((role) => currentRoles.includes(role));
}

function normalizeRoles(roles: unknown): string[] {
  if (Array.isArray(roles)) {
    return roles.filter((role): role is string => typeof role === "string");
  }

  if (typeof roles === "string") {
    const raw = roles.trim();

    if (!raw) {
      return [];
    }

    if (raw.startsWith("{") && raw.endsWith("}")) {
      const body = raw.slice(1, -1).trim();

      if (!body) {
        return [];
      }

      return body
        .split(",")
        .map((entry) => entry.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }

    return [raw];
  }

  return [];
}

function canSuperAdminManageSchool(context: MeContextLite) {
  if (!context.isSuperAdmin || !context.currentSchool) {
    return false;
  }

  return context.currentSchool.management_mode !== "SELF_MANAGED";
}

function resolveEffectiveRoles(context: MeContextLite) {
  if (canSuperAdminManageSchool(context)) {
    return ["SCHOOL_ADMIN", "TEACHER", "FINANCE_ADMIN"];
  }

  return context.currentRoles;
}

async function fetchMeContext(
  token: string,
  schoolId: string,
): Promise<MeContextLite | null> {
  const contextPath = schoolId
    ? `/me/context?schoolId=${encodeURIComponent(schoolId)}`
    : "/me/context";

  try {
    const res = await fetch(`${API_BASE_URL}${contextPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as MeContextLite;
    return {
      isSuperAdmin: Boolean(data?.isSuperAdmin),
      currentRoles: normalizeRoles(data?.currentRoles),
      currentSchool: data?.currentSchool ?? null,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  ) {
    const originFailure = assertTrustedOrigin(request);
    if (originFailure) return originFailure;
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getSessionCookieName())?.value ?? "";

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const schoolId = request.cookies.get(AUTH_SCHOOL_COOKIE_NAME)?.value ?? "";
  const context = await fetchMeContext(token, schoolId);

  if (!context) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (matchesPrefix(pathname, "/platform")) {
    if (!context.isSuperAdmin) {
      return NextResponse.redirect(new URL("/school", request.url));
    }
    return NextResponse.next();
  }

  if (context.isSuperAdmin && !canSuperAdminManageSchool(context)) {
    return NextResponse.redirect(new URL("/platform", request.url));
  }

  const effectiveRoles = resolveEffectiveRoles(context);

  const matchingGate = SCHOOL_ROUTE_ROLE_GATES.find((gate) =>
    matchesPrefix(pathname, gate.prefix),
  );

  if (matchingGate && !hasAnyRole(effectiveRoles, matchingGate.roles)) {
    return NextResponse.redirect(new URL("/school", request.url));
  }

  if (!context.currentSchool && !matchesPrefix(pathname, "/school")) {
    return NextResponse.redirect(new URL("/school", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
