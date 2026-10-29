import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Gowes Gaskeun",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
