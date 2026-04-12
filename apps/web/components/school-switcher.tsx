"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SchoolOption = {
  school_id: string;
  school_name: string;
  school_code: string;
  membership_id: string;
  membership_status: string;
  roles: string[];
};

type SchoolSwitcherProps = {
  schools: SchoolOption[];
  currentSchoolId: string;
};

export function SchoolSwitcher({
  schools,
  currentSchoolId,
}: SchoolSwitcherProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(nextSchoolId: string) {
    setLoading(true);

    try {
      await fetch("/api/session/select-school", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ schoolId: nextSchoolId }),
      });

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      value={currentSchoolId}
      disabled={loading || schools.length === 0}
      onChange={(e) => handleChange(e.target.value)}
    >
      {schools.map((school) => (
        <option key={school.school_id} value={school.school_id}>
          {school.school_name} ({school.school_code})
        </option>
      ))}
    </select>
  );
}
