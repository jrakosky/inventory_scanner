"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanBarcode, LayoutDashboard, Package, Settings, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scanner", label: "Scan", icon: ScanBarcode },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-xs transition-all touch-target",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]")}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={cn("font-medium", isActive && "font-semibold")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TopBar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <ScanBarcode className="h-5 w-5 text-primary" />
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {title}
          </h1>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-md p-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
