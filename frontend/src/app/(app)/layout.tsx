"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const NAV = [
  {
    href: "/dashboard",
    label: "Projects",
    match: (p: string) => p === "/dashboard" || p.startsWith("/projects"),
  },
  {
    href: "/settings/providers",
    label: "AI providers",
    match: (p: string) => p.startsWith("/settings"),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useApi<User>("/auth/me");

  async function signOut() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="border-b border-rule bg-sheet">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-6 px-4">
          <Link href="/dashboard" className="font-mono text-sm">
            <span className="bg-marker px-1">margin</span>
          </Link>
          <nav aria-label="Main" className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.match(pathname) ? "page" : undefined}
                className="rounded-[4px] px-2 py-1 text-sm text-ink-2 hover:bg-wash hover:text-ink aria-[current=page]:font-medium aria-[current=page]:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-ink-3 sm:inline">{user?.email}</span>
            <button
              onClick={signOut}
              className="rounded-[4px] px-2 py-1 text-ink-2 hover:bg-wash hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">{children}</div>
    </div>
  );
}
