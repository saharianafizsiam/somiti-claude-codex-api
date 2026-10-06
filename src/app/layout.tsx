import type { Metadata } from "next";
import "./globals.css";
import { Toasts } from "@/components/toasts";
export const metadata: Metadata = {
  title: { default: "Somiti API", template: "%s · Somiti API" },
  description:
    "Your AI gateway. One place to manage models, access, and credit.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toasts />
      </body>
    </html>
  );
}
