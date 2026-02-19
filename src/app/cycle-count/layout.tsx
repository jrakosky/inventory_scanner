"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BottomNav, TopBar } from "@/components/nav";
import { Loader2 } from "lucide-react";

export default function CycleCountLayout({ children }: { children: React.ReactNode }) {
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
    <div className="min-h-screen pb-20">
      <TopBar title="Cycle Count" />
      <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
