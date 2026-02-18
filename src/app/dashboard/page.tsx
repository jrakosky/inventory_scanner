"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Package,
  ScanBarcode,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  totalItems: number;
  totalQuantity: number;
  lowStockCount: number;
  recentScans: number;
  recentActivity: Array<{
    id: string;
    barcode: string;
    action: string;
    itemName: string;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/inventory?stats=true")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const greeting = session?.user?.name
    ? `Hey, ${session.user.name}`
    : "Welcome back";

  const statCards = [
    {
      label: "Total Items",
      value: stats?.totalItems ?? 0,
      icon: Package,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "Total Qty",
      value: stats?.totalQuantity ?? 0,
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "Low Stock",
      value: stats?.lowStockCount ?? 0,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Scans Today",
      value: stats?.recentScans ?? 0,
      icon: ScanBarcode,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{greeting}</h2>
        <p className="text-sm text-muted-foreground">
          Here&apos;s your inventory overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className={`rounded-lg ${stat.bg} p-2`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-3">
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {loading ? "—" : stat.value.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Action + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* Quick Action */}
      <Link href="/scanner">
        <Card className="group h-full cursor-pointer border-primary/20 bg-primary/5 transition-all hover:border-primary/40 hover:bg-primary/10">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/20 p-2.5">
                <ScanBarcode className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Start Scanning</p>
                <p className="text-sm text-muted-foreground">
                  Open camera to scan barcodes
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-1" />
          </CardContent>
        </Card>
      </Link>

      {/* Recent Activity */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Scans</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {scan.itemName}
                    </p>
                    <p
                      className="text-xs text-muted-foreground"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {scan.barcode}
                    </p>
                  </div>
                  <div className="ml-2 text-right">
                    <p className="text-xs capitalize text-muted-foreground">
                      {scan.action.toLowerCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(scan.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No scans yet. Start scanning to see activity here.
            </p>
          )}
        </CardContent>
      </Card>

      </div>
    </div>
  );
}
