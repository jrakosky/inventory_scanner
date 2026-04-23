"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanBarcode, LayoutDashboard, Package, Tag, ClipboardCheck, ListTodo, Settings, LogOut, UserCircle, Building2 } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { SnaLogo, SnaMark } from "@/components/logo";

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/scanner", label: "Scan", icon: ScanBarcode, adminOnly: false },
  { href: "/inventory", label: "Inventory", icon: Package, adminOnly: false },
  { href: "/warehouses", label: "Warehouses", icon: Building2, adminOnly: false },
  { href: "/cycle-count", label: "Count", icon: ClipboardCheck, adminOnly: false },
  { href: "/labels", label: "Labels", icon: Tag, adminOnly: false },
  { href: "/todos", label: "To-Do", icon: ListTodo, adminOnly: false },
  { href: "/account", label: "Account", icon: UserCircle, adminOnly: false },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

function useVisibleNavItems() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  return baseNavItems.filter(item => !item.adminOnly || isAdmin);
}

export function BottomNav() {
  const pathname = usePathname();
  const navItems = useVisibleNavItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/80 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-xs transition-all touch-target",
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

export function Sidebar() {
  const pathname = usePathname();
  const navItems = useVisibleNavItems();
  const { data: session } = useSession();

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col border-r border-border/40 bg-background/95 backdrop-blur-xl md:flex">
      <div className="flex h-16 items-center border-b border-border/40 px-4">
        <SnaLogo className="h-10 w-auto" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <item.icon
                className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]")}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/40 px-3 py-3 space-y-2">
        {session?.user && (
          <div className="px-3">
            <p className="text-xs font-medium truncate">
              {session.user.name || session.user.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {(session.user as any).role || "USER"}
            </p>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function TopBar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <SnaMark className="h-6 w-6 md:hidden" />
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {title}
          </h1>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-md p-2 text-muted-foreground hover:text-foreground transition-colors md:hidden"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
