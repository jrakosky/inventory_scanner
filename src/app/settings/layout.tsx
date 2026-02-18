"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BottomNav, Sidebar, TopBar } from "@/components/nav";
import { Loader2 } from "lucide-react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  if (status === "loading")
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (status === "unauthenticated") return null;

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Sidebar />
      <div className="sidebar-offset">
        <TopBar title="Settings" />
        <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
