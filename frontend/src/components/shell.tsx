"use client";

import {
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  PlugZap,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DropdownMenu } from "radix-ui";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Project, User } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { CommandPalette } from "./command-palette";
import { ICON_BUTTON, IconButton } from "./ui";

interface Shell {
  projects: Project[] | undefined;
  reloadProjects: () => void;
}

const ShellContext = createContext<Shell>({ projects: undefined, reloadProjects: () => {} });
export const useShell = () => useContext(ShellContext);

/**
 * Sidebar on desktop, a top bar with a drawer on mobile. The project list lives here so the
 * sidebar, the command palette and pages that create or delete projects share one copy.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const projects = useApi<Project[]>("/projects");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  // The drawer is open for the path it was opened on, so navigating closes it without an effect.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawerOpen = drawerPath === pathname;
  const setDrawerOpen = (open: boolean) => setDrawerPath(open ? pathname : null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Two instances (desktop rail, mobile drawer) need separate layout groups for the nav chip.
  const nav = (id: string) => (
    <LayoutGroup id={id}>
      <SidebarContent onSearch={() => setPaletteOpen(true)} />
    </LayoutGroup>
  );
  return (
    <ShellContext.Provider value={{ projects: projects.data, reloadProjects: projects.reload }}>
      <a
        href="#content"
        className="sr-only z-50 rounded-control bg-ink px-3 py-2 text-sheet focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="min-h-dvh lg:grid lg:h-dvh lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-rule bg-rail lg:flex lg:min-h-0 lg:flex-col">
          {nav("rail")}
        </aside>
        <MobileBar
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onSearch={() => setPaletteOpen(true)}
        >
          {nav("drawer")}
        </MobileBar>
        <div id="content" className="flex min-w-0 flex-col lg:min-h-0 lg:overflow-y-auto">
          {children}
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} projects={projects.data} />
    </ShellContext.Provider>
  );
}

function Logo() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 rounded-control font-mono text-[15px]"
    >
      <span className="rounded-[3px] bg-marker px-1.5 py-px font-semibold text-ink">margin</span>
      <span className="font-sans text-xs text-ink-3">code review</span>
    </Link>
  );
}

function SidebarContent({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  const { projects } = useShell();
  return (
    <>
      <div className="flex h-14 shrink-0 items-center px-4">
        <Logo />
      </div>
      <div className="px-3">
        <button
          type="button"
          onClick={onSearch}
          className="flex h-8 w-full items-center gap-2 rounded-control border border-rule bg-sheet px-2.5 text-sm text-ink-3 shadow-panel transition-colors hover:border-ink-3/50 hover:text-ink-2"
        >
          <Search aria-hidden className="size-3.5" />
          Jump to…
          <kbd className="ml-auto">⌘K</kbd>
        </button>
      </div>
      <nav
        aria-label="Main"
        className="mt-4 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4"
      >
        <NavGroup>
          <NavItem href="/dashboard" icon={LayoutDashboard} active={pathname === "/dashboard"}>
            Dashboard
          </NavItem>
          <NavItem
            href="/settings/providers"
            icon={PlugZap}
            active={pathname.startsWith("/settings")}
          >
            AI providers
          </NavItem>
        </NavGroup>
        <NavGroup
          title="Projects"
          action={
            <Link
              href="/projects/new"
              aria-label="New project"
              className="rounded-control p-1 text-ink-3 hover:bg-wash hover:text-ink"
            >
              <Plus aria-hidden className="size-3.5" />
            </Link>
          }
        >
          {projects?.map((p) => (
            <NavItem
              key={p.id}
              href={`/projects/${p.id}`}
              active={pathname.startsWith(`/projects/${p.id}`)}
              count={p._count.reviews || undefined}
              mono
            >
              {p.name}
            </NavItem>
          ))}
          {projects?.length === 0 && (
            <p className="px-2 py-1 text-xs text-ink-3">No projects yet.</p>
          )}
        </NavGroup>
      </nav>
      <AccountMenu />
    </>
  );
}

function NavGroup({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      {title && (
        <div className="mb-1 flex items-center justify-between px-2">
          <p className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{title}</p>
          {action}
        </div>
      )}
      <ul className="space-y-px">{children}</ul>
    </div>
  );
}

/** The active item gets a raised white chip; it slides between items (layoutId). */
function NavItem({
  href,
  icon: Icon,
  active,
  count,
  mono,
  children,
}: {
  href: string;
  icon?: LucideIcon;
  active: boolean;
  count?: number;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="relative">
      {active && (
        <motion.span
          layoutId="nav-active"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="absolute inset-0 rounded-control border border-rule bg-sheet shadow-panel"
        />
      )}
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`relative flex h-8 items-center gap-2 rounded-control px-2 text-sm transition-colors ${
          active ? "font-medium text-ink" : "text-ink-2 hover:bg-wash hover:text-ink"
        }`}
      >
        {Icon ? (
          <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
        ) : (
          <span
            aria-hidden
            className={`size-1.5 shrink-0 rounded-full ${active ? "bg-ink" : "bg-ink-3/50"} mx-[5px]`}
          />
        )}
        <span className={`truncate ${mono ? "font-mono text-[13px]" : ""}`}>{children}</span>
        {count !== undefined && (
          <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-3">{count}</span>
        )}
      </Link>
    </li>
  );
}

function AccountMenu() {
  const router = useRouter();
  const { data: user } = useApi<User>("/auth/me");

  async function signOut() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const initial = user?.email[0]?.toUpperCase() ?? "·";
  return (
    <div className="shrink-0 border-t border-rule p-3">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="flex w-full items-center gap-2 rounded-control p-1.5 text-left text-sm hover:bg-wash data-[state=open]:bg-wash">
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-semibold text-sheet"
          >
            {initial}
          </span>
          <span className="min-w-0 flex-1 truncate text-ink-2">{user?.email ?? "Account"}</span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="start"
            sideOffset={6}
            className="z-50 w-[var(--radix-dropdown-menu-trigger-width)] animate-pop-in rounded-panel border border-rule bg-sheet p-1 shadow-pop"
          >
            <DropdownMenu.Label className="px-2 py-1.5 text-xs text-ink-3">
              Signed in as
              <span className="block truncate text-ink">{user?.email}</span>
            </DropdownMenu.Label>
            <DropdownMenu.Separator className="my-1 h-px bg-rule" />
            <DropdownMenu.Item
              onSelect={signOut}
              className="flex cursor-default items-center gap-2 rounded-control px-2 py-1.5 text-sm text-ink outline-none data-highlighted:bg-wash"
            >
              <LogOut aria-hidden className="size-4 text-ink-2" />
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

/** Mobile: a slim top bar; the same sidebar content opens as a drawer (Radix Dialog). */
function MobileBar({
  open,
  onOpenChange,
  onSearch,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-rule bg-sheet/95 px-3 lg:hidden">
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Trigger aria-label="Open navigation" className={ICON_BUTTON}>
          <Menu aria-hidden strokeWidth={1.75} className="size-4" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-ink/30" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] animate-drawer-in flex-col bg-rail shadow-pop">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Close
              aria-label="Close navigation"
              className={`${ICON_BUTTON} absolute top-3.5 right-3`}
            >
              <X aria-hidden strokeWidth={1.75} className="size-4" />
            </Dialog.Close>
            {children}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Logo />
      <IconButton label="Jump to…" icon={Search} onClick={onSearch} className="ml-auto" />
    </div>
  );
}
