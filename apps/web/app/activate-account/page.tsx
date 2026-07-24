import { ActivateAccountClient } from "@/components/activate-account-client";

export const metadata = {
  title: "Activation du compte",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ActivateAccountPage() {
  return <ActivateAccountClient />;
}
