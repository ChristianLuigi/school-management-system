import { ResetPasswordClient } from "@/components/reset-password-client";

export const metadata = {
  title: "Réinitialiser le mot de passe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}