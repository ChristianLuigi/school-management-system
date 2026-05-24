"use client";

import { StudentGuardiansPanelClient } from "@/components/student-guardians-panel-client";
import type { StudentGuardianRow } from "@/components/student-guardians-panel-client";

export function StudentGuardiansManagementPanelClient({
  schoolId,
  studentId,
  guardians,
  onUpdated,
}: {
  schoolId: string;
  studentId: string;
  guardians: StudentGuardianRow[];
  onUpdated: () => void;
}) {
  return (
    <StudentGuardiansPanelClient
      schoolId={schoolId}
      studentId={studentId}
      guardians={guardians}
      onChanged={onUpdated}
    />
  );
}