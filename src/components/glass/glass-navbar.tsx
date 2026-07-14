"use client";

import { useSession, signOut } from "next-auth/react";
import { useAppStore, type ModuleId } from "@/lib/store";
import { canAccessModule, type Role } from "@/lib/security";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Clapperboard, GraduationCap, LogOut, Menu, X, ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/security";

const MODULES: Array<{ id: ModuleId; label: string; icon: typeof LayoutDashboard; access: string }> = [
  { id: "dashboard", label: "Dashboard Operasi", icon: LayoutDashboard, access: "dashboard" },
  { id: "video_studio", label: "Studio Video AI", icon: Clapperboard, access: "video_studio" },
  { id: "elearning", label: "e-Pembelajaran Dron", icon: GraduationCap, access: "elearning" },
];

export function GlassNavbar() {
  const { data: session } = useSession();
  const { activeModule, setActiveModule, sidebarOpen, setSidebarOpen } = useAppStore();
  const role = (session?.user?.role ?? null) as Role | null;

  const visibleModules = MODULES.filter((m) => canAccessModule(m.access, role));

  const initials = (session?.user?.name ?? "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="glass-nav border-b border-white/15">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-3">
          {/* Logo + brand */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-2 -ml-2 text-foreground/80 hover:text-foreground"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Tukar menu"
            >
              {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-9 rounded-xl bg-gradient-to-br from-teal to-navy-soft border border-gold/40 flex items-center justify-center shadow-lg shrink-0">
                <ShieldCheck className="size-5 text-gold" />
              </div>
              <div className="min-w-0 hidden sm:block">
                <div className="font-display font-bold text-sm leading-tight text-foreground truncate">
                  SIRI-AI
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  Jabatan Tenaga Manusia
                </div>
              </div>
            </div>
          </div>

          {/* Desktop module switcher */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {visibleModules.map((m) => {
              const Icon = m.icon;
              const active = activeModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveModule(m.id)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all",
                    active
                      ? "bg-teal/30 border border-teal/50 text-teal-soft shadow-inner"
                      : "text-foreground/70 hover:text-foreground hover:bg-white/8 border border-transparent"
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden xl:inline">{m.label}</span>
                  <span className="xl:hidden">{m.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </nav>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-white/8 border border-transparent hover:border-white/15 transition-all">
                <Avatar className="size-8 border border-gold/40">
                  <AvatarFallback className="bg-navy-soft text-gold text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left min-w-0">
                  <div className="text-xs font-medium text-foreground truncate max-w-[140px]">
                    {session?.user?.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                    {session?.user?.role ? ROLE_LABELS[session.user.role as Role] : ""}
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 glass-dark border-white/20">
              <DropdownMenuLabel className="text-foreground">
                <div className="font-medium">{session?.user?.name}</div>
                <div className="text-xs text-muted-foreground font-normal">{session?.user?.email}</div>
                <div className="text-[11px] text-teal-soft mt-1">
                  {session?.user?.unit} · {session?.user?.position}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className="text-red-300 focus:text-red-200 focus:bg-red-500/15 cursor-pointer"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="size-4 mr-2" />
                Log Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="lg:hidden glass-nav border-b border-white/15 animate-glass-in">
          <nav className="max-w-7xl mx-auto px-3 py-3 flex flex-col gap-1">
            {visibleModules.map((m) => {
              const Icon = m.icon;
              const active = activeModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveModule(m.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                    active
                      ? "bg-teal/30 border border-teal/50 text-teal-soft"
                      : "text-foreground/80 hover:bg-white/8 border border-transparent"
                  )}
                >
                  <Icon className="size-4" />
                  {m.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
