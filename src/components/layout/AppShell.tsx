"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, MotionConfig, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileSearch,
  BarChart3,
  ClipboardCheck,
  ShieldCheck,
  Bot,
  Settings,
  ShieldAlert,
  Menu,
  X,
  Bell,
  Search,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  CheckCheck,
  BookOpen,
} from "lucide-react";
import { FloatingAssistant } from "@/components/assistant/FloatingAssistant";
import { ZervixLogo } from "@/components/brand/ZervixLogo";
import { applyTheme, getStoredThemePreference, ThemePreference } from "@/lib/theme";

export interface ShellUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  avatarColor: string;
  subscriptionTier?: string;
}

export interface ShellNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

interface AppShellProps {
  user: ShellUser;
  initialNotifications: ShellNotification[];
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  toolbarRight?: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspace", label: "Sanitization Workspace", icon: FileSearch },
  { href: "/analytics", label: "Detection Analytics", icon: BarChart3 },
  { href: "/audit-reports", label: "Audit Reports", icon: ClipboardCheck },
  { href: "/privacy-security", label: "Privacy & Security", icon: ShieldCheck },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/about", label: "About & Guide", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  user,
  initialNotifications,
  children,
  searchValue,
  onSearchChange,
  toolbarRight,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [clickedHref, setClickedHref] = useState<string | null>(null);
  const [notifications, setNotifications] =
    useState<ShellNotification[]>(initialNotifications);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchValue ?? "");
  const [liveOverrides, setLiveOverrides] = useState<{
    name?: string;
    avatarColor?: string;
  }>({});
  const [isLight, setIsLight] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    const ds = document.documentElement.dataset.theme;
    if (ds === "light" || ds === "dark") return ds === "light";
    const meta = document.querySelector('meta[name="color-scheme"]');
    return meta?.getAttribute("content") === "light";
  });

  const displayName = liveOverrides.name ?? user.name;
  const displayAvatarColor = liveOverrides.avatarColor ?? user.avatarColor ?? "#8B5CF6";

  const drawerRef = useRef<HTMLDialogElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onUserUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; avatarColor?: string }>).detail;
      if (detail) {
        setLiveOverrides((prev) => ({ ...prev, ...detail }));
      }
    };
    const onThemeUpdated = (e: Event) => {
      const detail = (
        e as CustomEvent<{ theme?: ThemePreference; effective?: "light" | "dark" }>
      ).detail;
      if (detail?.effective) {
        setIsLight(detail.effective === "light");
      } else if (detail?.theme === "LIGHT") {
        setIsLight(true);
      } else if (detail?.theme === "DARK") {
        setIsLight(false);
      }
    };
    const mq =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: light)")
        : null;
    const onSystemChange = () => {
      if (getStoredThemePreference() === "SYSTEM") {
        const eff = applyTheme("SYSTEM");
        setIsLight(eff === "light");
      }
    };
    window.addEventListener("zervix:user-updated", onUserUpdated);
    window.addEventListener("zervix:theme-updated", onThemeUpdated);
    mq?.addEventListener?.("change", onSystemChange);
    return () => {
      window.removeEventListener("zervix:user-updated", onUserUpdated);
      window.removeEventListener("zervix:theme-updated", onThemeUpdated);
      mq?.removeEventListener?.("change", onSystemChange);
    };
  }, []);

  // Ensure strict browser session isolation between user accounts & welcome check
  useEffect(() => {
    try {
      const prevUserId = window.sessionStorage.getItem("zervix_active_user_id");
      if (prevUserId && prevUserId !== user.id) {
        window.sessionStorage.clear();
      }
      window.sessionStorage.setItem("zervix_active_user_id", user.id);

      if (!window.sessionStorage.getItem("zervix_welcome_ack")) {
        const target = pathname && pathname !== "/welcome" ? pathname : "/dashboard";
        router.replace(`/welcome?next=${encodeURIComponent(target)}`);
      }
    } catch {
      // Ignore storage restrictions
    }
  }, [pathname, router, user.id]);

  // Clear optimistic pending route and reset right-pane scroll when pathname finishes updating
  useEffect(() => {
    const timer = setTimeout(() => {
      setPendingHref(null);
      rightScrollRef.current?.scrollTo({ top: 0 });
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  const navItems =
    user.role === "ADMIN"
      ? [...NAV_ITEMS, { href: "/admin", label: "Admin Console", icon: ShieldAlert }]
      : NAV_ITEMS;

  const activeRoute = pendingHref ?? pathname;

  const currentNav =
    navItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    ) ?? navItems[0];

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleNavClick(href: string, isMobile: boolean) {
    setPendingHref(href);
    setClickedHref(href);
    setTimeout(() => {
      setClickedHref((prev) => (prev === href ? null : prev));
    }, 450);
    if (isMobile) drawerRef.current?.close();
  }

  function toggleTheme() {
    const nextTheme: ThemePreference = isLight ? "DARK" : "LIGHT";
    const eff = applyTheme(nextTheme);
    setIsLight(eff === "light");
    void fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: nextTheme }),
    });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
  }

  async function handleLogout() {
    try {
      window.sessionStorage.removeItem("zervix_welcome_ack");
    } catch {
      // Ignore storage restrictions
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (onSearchChange) {
      onSearchChange(localSearch);
      return;
    }
    if (localSearch.trim()) {
      router.push(`/audit-reports?search=${encodeURIComponent(localSearch.trim())}`);
    }
  }

  const sidebarContent = (isMobile: boolean) => {
    const scope = isMobile ? "mobile" : "desktop";
    return (
      <div className="flex flex-col h-full bg-[var(--bg-sidebar)] backdrop-blur-md border-r border-[var(--border-subtle)] select-none">
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-[var(--border-subtle)]">
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
            <motion.div
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
            >
              <ZervixLogo size="md" />
            </motion.div>
            {!collapsed || isMobile ? (
              <div className="min-w-0">
                <div className="text-base font-bold tracking-[0.12em] zervix-brand-wordmark bg-clip-text text-transparent">
                  ZERVIX
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] truncate">
                  Your Data. Your Privacy. Your Control.
                </p>
              </div>
            ) : null}
          </Link>

          {isMobile ? (
            <button
              type="button"
              onClick={() => drawerRef.current?.close()}
              aria-label="Close navigation menu"
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Animated Navigation */}
        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active =
              activeRoute === item.href || activeRoute.startsWith(`${item.href}/`);
            const justClicked = clickedHref === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={() => handleNavClick(item.href, isMobile)}
                aria-current={active ? "page" : undefined}
                title={collapsed && !isMobile ? item.label : undefined}
                className="block relative rounded-xl focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <motion.div
                  whileHover={{ x: collapsed && !isMobile ? 0 : 3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]"
                  }`}
                >
                  {/* Sliding glowing pill background */}
                  {active ? (
                    <motion.span
                      layoutId={`zervix-nav-pill-${scope}`}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-xl zervix-nav-active"
                    />
                  ) : null}

                  {/* Sliding left violet-to-cyan indicator bar */}
                  {active ? (
                    <motion.span
                      layoutId={`zervix-nav-bar-${scope}`}
                      transition={{ type: "spring", stiffness: 420, damping: 30 }}
                      aria-hidden="true"
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-cyan-400 via-violet-400 to-purple-500 shadow-[0_0_10px_rgba(34,211,238,0.65)]"
                    />
                  ) : null}

                  {/* Click pulse shimmer */}
                  <AnimatePresence>
                    {justClicked ? (
                      <motion.span
                        key="pulse"
                        initial={{ opacity: 0.55, scale: 0.92 }}
                        animate={{ opacity: 0, scale: 1.04 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        aria-hidden="true"
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-400/25 via-violet-400/20 to-transparent pointer-events-none"
                      />
                    ) : null}
                  </AnimatePresence>

                  {/* Animated Icon */}
                  <motion.span
                    animate={
                      justClicked
                        ? { scale: [1, 1.24, 1], rotate: [0, -6, 0] }
                        : { scale: active ? 1.05 : 1, rotate: 0 }
                    }
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="relative z-10 flex items-center justify-center shrink-0"
                  >
                    <Icon
                      className={`w-4 h-4 transition-colors duration-150 ${
                        active
                          ? "text-violet-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                          : "text-[var(--text-secondary)] group-hover:text-cyan-400"
                      }`}
                      aria-hidden="true"
                    />
                  </motion.span>

                  {!collapsed || isMobile ? (
                    <span className="relative z-10 truncate">{item.label}</span>
                  ) : null}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Profile & Plan Card */}
        <div className="p-3 border-t border-[var(--border-subtle)]">
          <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white font-semibold text-xs shadow-inner transition-colors duration-200"
              style={{ backgroundColor: displayAvatarColor }}
            >
              {displayName
                .split(" ")
                .filter(Boolean)
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            {!collapsed || isMobile ? (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  {displayName}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  {user.email}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-medium">
                    {user.role}
                  </span>
                  {user.subscriptionTier ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-medium">
                      {user.subscriptionTier.replace(/_/g, " ")}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative z-10 min-h-screen lg:h-dvh lg:overflow-hidden flex bg-transparent text-[var(--text-primary)]">
        {/* Desktop Sidebar (fixed viewport height, independent from right-side scroll) */}
        <aside
          className={`hidden lg:block shrink-0 h-full overflow-hidden transition-all duration-200 ${
            collapsed ? "w-[76px]" : "w-[264px]"
          }`}
        >
          {sidebarContent(false)}
        </aside>

        {/* Mobile Modal Navigation Drawer */}
        <dialog
          ref={drawerRef}
          aria-label="Navigation drawer"
          closedby="any"
          className="lg:hidden m-0 p-0 bg-transparent h-full max-h-none w-[280px] max-w-[85vw] border-0"
        >
          {sidebarContent(true)}
        </dialog>

        {/* Right Main Column (only this right-side content region scrolls on desktop) */}
        <div className="flex-1 flex flex-col min-w-0 lg:h-full lg:overflow-hidden">
          {/* Top Bar */}
          <header className="shrink-0 sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/85 backdrop-blur-xl px-4 sm:px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left: Mobile drawer button + Breadcrumb */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => drawerRef.current?.showModal()}
                  aria-label="Open navigation menu"
                  className="lg:hidden p-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-white/5"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
                  <span className="text-[var(--text-secondary)] hidden sm:inline">
                    ZERVIX
                  </span>
                  <span className="text-[var(--text-secondary)] hidden sm:inline">
                    /
                  </span>
                  <h1 className="font-semibold text-[var(--text-primary)] truncate">
                    {currentNav.label}
                  </h1>
                </div>
              </div>

              {/* Right: Search + Page Controls + Theme + Notifications + Profile */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <search className="hidden md:block">
                  <form onSubmit={handleSearchSubmit} className="relative group">
                    <Search
                      className="w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-cyan-400 transition-colors absolute left-3 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={onSearchChange ? searchValue ?? "" : localSearch}
                      onChange={(e) => {
                        setLocalSearch(e.target.value);
                        onSearchChange?.(e.target.value);
                      }}
                      placeholder="Search audits or files..."
                      aria-label="Search audits or files"
                      className="w-52 lg:w-64 focus:w-64 lg:focus:w-72 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-cyan-400/60 focus:shadow-[0_0_16px_rgba(34,211,238,0.18)] focus:outline-none transition-all duration-200"
                    />
                  </form>
                </search>

                {toolbarRight}

                {/* Theme Toggle */}
                <motion.button
                  type="button"
                  onClick={toggleTheme}
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 450, damping: 24 }}
                  aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
                  title={isLight ? "Switch to dark theme" : "Switch to light theme"}
                  className="p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-cyan-400 hover:border-cyan-400/45 hover:shadow-[0_0_14px_rgba(34,211,238,0.18)]"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={isLight ? "moon" : "sun"}
                      initial={{ rotate: -60, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: 60, opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="flex items-center justify-center"
                    >
                      {isLight ? (
                        <Moon className="w-4 h-4" />
                      ) : (
                        <Sun className="w-4 h-4" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>

                {/* Notifications */}
                <div className="relative">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.07 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 450, damping: 24 }}
                    onClick={() => {
                      setNotifOpen((o) => !o);
                      setProfileOpen(false);
                    }}
                    aria-label="Notifications"
                    aria-expanded={notifOpen}
                    className="group relative p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-violet-400 hover:border-violet-400/45 hover:shadow-[0_0_14px_rgba(139,92,246,0.2)]"
                  >
                    <Bell className="w-4 h-4 transition-transform duration-200 group-hover:-rotate-12" />
                    {unreadCount > 0 ? (
                      <motion.span
                        initial={{ scale: 0.7 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 20 }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.65)]"
                      >
                        {unreadCount}
                      </motion.span>
                    ) : null}
                  </motion.button>

                  <AnimatePresence>
                    {notifOpen ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.93, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ type: "spring", stiffness: 420, damping: 28 }}
                        style={{ transformOrigin: "top right" }}
                        className="absolute right-0 mt-2 w-80 max-w-[90vw] zervix-elevated rounded-2xl p-3 shadow-2xl z-50"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
                          <span className="text-xs font-semibold">Notifications</span>
                          <button
                            type="button"
                            onClick={() => void markAllRead()}
                            className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <CheckCheck className="w-3 h-3" />
                            Mark all read
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {notifications.length === 0 ? (
                            <p className="text-xs text-[var(--text-secondary)] py-4 text-center">
                              No notifications yet.
                            </p>
                          ) : (
                            notifications.slice(0, 6).map((n) => (
                              <div
                                key={n.id}
                                className={`p-2.5 rounded-xl border text-xs ${
                                  n.read
                                    ? "border-transparent bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)]"
                                    : "border-violet-500/30 bg-violet-500/10 text-[var(--text-primary)]"
                                }`}
                              >
                                <div className="font-semibold">{n.title}</div>
                                <div className="text-[11px] opacity-85 mt-0.5">
                                  {n.message}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                {/* Profile Dropdown */}
                <div className="relative">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 420, damping: 26 }}
                    onClick={() => {
                      setProfileOpen((o) => !o);
                      setNotifOpen(false);
                    }}
                    aria-expanded={profileOpen}
                    aria-label="Open profile menu"
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 hover:border-violet-400/50 hover:shadow-[0_0_16px_rgba(139,92,246,0.2)]"
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-semibold transition-colors duration-200"
                      style={{ backgroundColor: displayAvatarColor }}
                    >
                      {displayName[0]?.toUpperCase() ?? "Z"}
                    </span>
                    <span className="hidden sm:inline text-xs font-medium max-w-[120px] truncate">
                      {displayName}
                    </span>
                  </motion.button>

                  <AnimatePresence>
                    {profileOpen ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.93, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ type: "spring", stiffness: 420, damping: 28 }}
                        style={{ transformOrigin: "top right" }}
                        className="absolute right-0 mt-2 w-56 zervix-elevated rounded-2xl p-2 shadow-2xl z-50"
                      >
                        <div className="px-3 py-2 border-b border-[var(--border-subtle)] mb-1">
                          <div className="text-xs font-semibold truncate">{displayName}</div>
                          <div className="text-[11px] text-[var(--text-secondary)] truncate">
                            {user.email}
                          </div>
                        </div>
                        <Link
                          href="/settings"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-white/5"
                        >
                          <UserIcon className="w-3.5 h-3.5 text-violet-400" />
                          Profile & Settings
                        </Link>
                        {user.role === "ADMIN" ? (
                          <Link
                            href="/admin"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-white/5"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                            Admin Console
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleLogout()}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 mt-1"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </header>

          {/* Scrollable Right-Side Main Content */}
          <div
            ref={rightScrollRef}
            className="zervix-scroll-pane flex-1 lg:overflow-y-auto overscroll-y-contain"
          >
            <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                {children}
              </motion.div>
            </main>
          </div>
        </div>

        {/* Floating Assistant everywhere except /assistant page where it's embedded */}
        {pathname !== "/assistant" ? (
          <FloatingAssistant appContext={`Current page: ${currentNav.label}`} />
        ) : null}
      </div>
    </MotionConfig>
  );
}
