import { ShieldCheck, Lock } from "lucide-react";

/**
 * Sticky footer per UI rules — sticks to bottom on short pages,
 * pushed down naturally on long pages. Use with parent `min-h-screen flex flex-col` + `mt-auto`.
 */
export function GlassFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto">
      <div className="glass-nav border-t border-white/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-teal-soft" />
            <span>
              <span className="font-semibold text-foreground/80">SIRI-AI</span> · Jabatan Tenaga
              Manusia Malaysia
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">v1.0 · Draf untuk Semakan</span>
            <span className="flex items-center gap-1.5">
              <Lock className="size-3 text-gold" />
              PDPA · HTTPS · RBAC
            </span>
            <span>© {year} JTM</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
