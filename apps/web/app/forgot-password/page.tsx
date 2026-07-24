import { ForgotPasswordClient } from "@/components/forgot-password-client";

export const metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}