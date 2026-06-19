// src/components/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Wallet,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/products", label: "Products", icon: Package },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/inventory", label: "Inventory", icon: Boxes },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return (
    <aside className="hidden md:flex w-60 flex-col border-r bg-white">
      <div className="px-6 py-5 border-b">
        <h1 className="text-lg font-semibold tracking-tight">ERP Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Live business dashboard</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const href = query ? `${item.href}?${query}` : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t text-xs text-muted-foreground">
        Synced from legacy ERP
      </div>
    </aside>
  );
}
