"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";

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
  const [error, setError] = useState("");
  const { locale } = useI18n();

  async function handleChange(nextSchoolId: string) {
    if (loading || nextSchoolId === currentSchoolId) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/session/select-school", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ schoolId: nextSchoolId }),
      });
      if (!response.ok) throw new Error("School switch failed");
      // Landing on the new school's dashboard discards old-school record IDs and year filters.
      router.push("/school");
      router.refresh();
    } catch {
      setError(
        locale === "fr"
          ? "Changement d’école impossible. Réessayez."
          : "Unable to switch school. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-0 max-w-60">
      <select
        aria-label={locale === "fr" ? "Changer d’école" : "Switch school"}
        className="min-h-10 max-w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground transition-colors hover:bg-surface-muted disabled:opacity-60"
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
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
