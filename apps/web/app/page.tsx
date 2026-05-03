import { redirect } from "next/navigation";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type SetupStatus = {
  isComplete: boolean;
};

export default async function HomePage() {
  const context = await getMeContext();

  if (context.isSuperAdmin) {
    redirect("/platform");
  }

  const schoolId = resolveCurrentSchoolId(context);

  if (!schoolId) {
    redirect("/login");
  }

  const effectiveRoles = resolveEffectiveRoles(context);

  if (!effectiveRoles.includes("SCHOOL_ADMIN")) {
    redirect("/school");
  }

  const setup = await serverApiGet<SetupStatus>(
    `/school-setup/status?schoolId=${schoolId}`,
  ).catch(() => null);

  if (setup && !setup.isComplete) {
    redirect("/setup");
  }

  redirect("/school");
}
