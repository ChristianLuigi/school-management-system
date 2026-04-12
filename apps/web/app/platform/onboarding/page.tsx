import { PlatformShell } from "@/components/platform-shell";

export default function PlatformOnboardingPage() {
  return (
    <PlatformShell>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Onboarding</h1>
        <p className="text-slate-600">
          Tenant onboarding tracking will go here next.
        </p>
      </div>
    </PlatformShell>
  );
}