import { Suspense } from "react";
import { LoginClient } from "@/components/login-client";
import { getServerTranslator } from "@/lib/i18n";

export async function generateMetadata() {
  const { t } = await getServerTranslator();
  return { title: t("login.title"), robots: { index: false, follow: false } };
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginClient /></Suspense>;
}
