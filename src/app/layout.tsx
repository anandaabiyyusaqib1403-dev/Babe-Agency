import type { Metadata } from "next";
import { AppShellStateProvider } from "@/components/app-shell-state";
import { ToastProvider } from "@/components/ui-overlays";
import "./globals.css";
import "./app.css";

export const metadata: Metadata = {
  title: { default: "BABE AGENCY", template: "%s · BABE AGENCY" },
  description: "Internal Creative Agency Management System",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppShellStateProvider><ToastProvider>{children}</ToastProvider></AppShellStateProvider></body></html>;
}
