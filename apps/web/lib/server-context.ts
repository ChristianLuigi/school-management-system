import { getServerSchoolId } from "@/lib/auth-server";
import { serverApiGet } from "@/lib/server-api";

type AcademicYear = {
  id: string;
  name_i18n: Record<string, string>;
  status: "PLANNED" | "ACTIVE" | "CLOSED";
};

type GradingPeriod = {
  id: string;
  name_i18n: Record<string, string>;
  is_current: boolean;
  sequence_no: number;
};

type ManagementMode =
  | "SELF_MANAGED"
  | "SUPERADMIN_MANAGED"
  | "HYBRID_MANAGED";

export type MeContext = {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    platformRole: "SUPER_ADMIN" | null;
  };
  isSuperAdmin: boolean;
  availableSchools: Array<{
    school_id: string;
    school_name: string;
    school_code: string;
    school_status: string;
    management_mode: ManagementMode;
    membership_id: string;
    membership_status: string;
    roles: string[];
  }>;
  currentSchool:
    | {
        school_id: string;
        school_name: string;
        school_code: string;
        school_status: string;
        management_mode: ManagementMode;
        membership_id: string;
        membership_status: string;
        roles: string[];
      }
    | {
        id: string;
        name: string;
        code: string;
        status: string;
        management_mode: ManagementMode;
      }
    | null;
  currentRoles: string[];
};

export async function getMeContext() {
  const schoolIdFromCookie = await getServerSchoolId();

  const contextPath = schoolIdFromCookie
    ? `/me/context?schoolId=${schoolIdFromCookie}`
    : "/me/context";

  return serverApiGet<MeContext>(contextPath);
}

export function resolveCurrentSchoolId(context: MeContext) {
  if (!context.currentSchool) return "";

  if ("school_id" in context.currentSchool) {
    return context.currentSchool.school_id;
  }

  if ("id" in context.currentSchool) {
    return context.currentSchool.id;
  }

  return "";
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

export function hasSchoolRole(context: MeContext, role: string) {
  return normalizeRoles(context.currentRoles).includes(role);
}

export function canSuperAdminManageSchool(context: MeContext) {
  if (!context.isSuperAdmin || !context.currentSchool) {
    return false;
  }

  return context.currentSchool.management_mode !== "SELF_MANAGED";
}

export function resolveEffectiveRoles(context: MeContext) {
  if (canSuperAdminManageSchool(context)) {
    return ["SCHOOL_ADMIN", "TEACHER", "FINANCE_ADMIN"];
  }

  return normalizeRoles(context.currentRoles);
}

export async function getActiveAcademicContext(schoolId: string) {
  try {
    const years = await serverApiGet<AcademicYear[]>(
      `/academic/years?schoolId=${schoolId}`,
    );
    const activeYear =
      years.find((y) => y.status === "ACTIVE") ?? years[0] ?? null;

    if (!activeYear) {
      return { academicYearId: null, gradingPeriodId: null };
    }

    const periods = await serverApiGet<GradingPeriod[]>(
      `/academic/periods?academicYearId=${activeYear.id}`,
    );
    const currentPeriod =
      periods.find((p) => p.is_current) ?? periods[0] ?? null;

    return {
      academicYearId: activeYear.id,
      gradingPeriodId: currentPeriod?.id ?? null,
    };
  } catch {
    return { academicYearId: null, gradingPeriodId: null };
  }
}
