import { redirect } from "next/navigation";
import { getMeContext, hasSchoolRole, resolveCurrentSchoolId } from "@/lib/server-context";
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

  const setup = await serverApiGet<SetupStatus>(
    `/school-setup/status?schoolId=${schoolId}`,
  );

  if (hasSchoolRole(context, "SCHOOL_ADMIN") && !setup.isComplete) {
    redirect("/setup");
  }

  redirect("/school");
}