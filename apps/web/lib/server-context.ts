import { getServerSchoolId } from "@/lib/auth";
import { serverApiGet } from "@/lib/server-api";

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
        membership_id: string;
        membership_status: string;
        roles: string[];
      }
    | {
        id: string;
        name: string;
        code: string;
        status: string;
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

export function hasSchoolRole(context: MeContext, role: string) {
  return context.currentRoles.includes(role);
}