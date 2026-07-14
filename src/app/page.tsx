"use client";

import { useSession } from "next-auth/react";
import { useAppStore } from "@/lib/store";
import { GlassNavbar } from "@/components/glass/glass-navbar";
import { GlassFooter } from "@/components/glass/glass-footer";
import { LoginScreen } from "@/components/glass/login-screen";
import DashboardModule from "@/components/modules/dashboard";
import { VideoStudioModule } from "@/components/modules/video-studio";
import ELearningModule from "@/components/modules/elearning";
import { Loader2 } from "lucide-react";

/**
 * SIRI-AI JTM — main entry.
 * Single route "/" — auth gate + navbar + active module + sticky footer.
 * Module switching is client-side via useAppStore (no router navigation).
 */
export default function Page() {
  const { status } = useSession();
  const { activeModule } = useAppStore();

  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-screen">
        <div className="glass p-6 flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-teal-soft" />
          <div className="text-sm text-muted-foreground">Memuatkan SIRI-AI…</div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <GlassNavbar />
      <main className="flex-1">
        {activeModule === "dashboard" && <DashboardModule />}
        {activeModule === "video_studio" && <VideoStudioModule />}
        {activeModule === "elearning" && <ELearningModule />}
      </main>
      <GlassFooter />
    </div>
  );
}
