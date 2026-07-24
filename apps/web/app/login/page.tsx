import { Suspense } from "react";
import { LoginClient } from "@/components/login-client";

export const metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <Suspense fallback={null}><LoginClient /></Suspense>;
}
