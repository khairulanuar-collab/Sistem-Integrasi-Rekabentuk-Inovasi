"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, Lock, Mail, Sparkles, Clapperboard, GraduationCap } from "lucide-react";
import { toast } from "sonner";

const DEMO_ACCOUNTS = [
  { email: "admin@jtm.gov.my", role: "Pentadbir Sistem", color: "from-teal to-navy-soft" },
  { email: "manager1@jtm.gov.my", role: "Pengurus", color: "from-gold to-teal" },
  { email: "officer1@jtm.gov.my", role: "Pegawai", color: "from-navy-soft to-teal" },
  { email: "creative1@jtm.gov.my", role: "Krew Kreatif", color: "from-teal to-gold" },
  { email: "trainee1@jtm.gov.my", role: "Pelatih Dron", color: "from-gold to-navy-soft" },
];

export function LoginScreen() {
  const [email, setEmail] = useState("admin@jtm.gov.my");
  const [password, setPassword] = useState("Siri@2026");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        toast.error("Log masuk gagal", { description: "E-mel atau kata laluan tidak sah." });
      } else if (result?.ok) {
        toast.success("Selamat datang ke SIRI-AI", { description: "Sesi dimulakan." });
        window.location.reload();
      }
    } catch (err) {
      toast.error("Ralat sambungan", { description: "Sila cuba lagi." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6 items-center">
          {/* Left — brand hero */}
          <div className="hidden lg:flex flex-col gap-6 p-8 animate-glass-in">
            <div className="flex items-center gap-3">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-teal to-navy-soft border border-gold/50 flex items-center justify-center shadow-2xl">
                <ShieldCheck className="size-8 text-gold" />
              </div>
              <div>
                <div className="font-display font-extrabold text-3xl text-gradient-gold leading-tight">
                  SIRI-AI
                </div>
                <div className="text-sm text-muted-foreground">
                  Sistem Integrasi Rekabentuk & Inovasi
                </div>
              </div>
            </div>

            <h1 className="font-display text-3xl xl:text-4xl font-bold leading-tight text-foreground">
              Jabatan Tenaga Manusia
              <span className="block text-gradient-teal mt-1">Malaysia</span>
            </h1>

            <p className="text-muted-foreground text-base leading-relaxed max-w-md">
              Platform bersepadu untuk penghasilan Video Kemerdekaan berkonsepkan AI, Dashboard
              Operasi jabatan, dan Modul e-Pembelajaran Drone for Beginner.
            </p>

            <div className="grid grid-cols-3 gap-3 mt-2">
              <FeatureMini icon={Clapperboard} label="Video AI" />
              <FeatureMini icon={Sparkles} label="Dashboard" />
              <FeatureMini icon={GraduationCap} label="Dron" />
            </div>

            <div className="glass p-4 mt-2">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                <Lock className="size-3" />
                Dilindungi · Pematuhan PDPA Malaysia
              </div>
              <div className="text-[11px] text-muted-foreground/70">
                JWT Session · Row-Level Access Control · Audit Log · HTTPS/TLS
              </div>
            </div>
          </div>

          {/* Right — login form */}
          <div className="glass-strong p-6 sm:p-8 animate-glass-in">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <div className="size-12 rounded-xl bg-gradient-to-br from-teal to-navy-soft border border-gold/50 flex items-center justify-center">
                <ShieldCheck className="size-7 text-gold" />
              </div>
              <div>
                <div className="font-display font-extrabold text-xl text-gradient-gold">SIRI-AI</div>
                <div className="text-xs text-muted-foreground">Jabatan Tenaga Manusia</div>
              </div>
            </div>

            <h2 className="font-display text-2xl font-bold text-foreground mb-1">Log Masuk</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Sila masukkan kredensial JTM anda untuk meneruskan.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-foreground/90">E-mel</Label>
                <div className="relative">
                  <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@jtm.gov.my"
                    required
                    autoComplete="email"
                    className="pl-9 bg-white/8 border-white/20 text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-foreground/90">Kata Laluan</Label>
                <div className="relative">
                  <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="pl-9 bg-white/8 border-white/20 text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal to-teal-soft hover:from-teal-soft hover:to-teal text-white font-medium h-11 shadow-lg shadow-teal/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Mengesahkan…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4 mr-2" />
                    Log Masuk SIRI-AI
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2.5">
                Akaun Demo (kata laluan: Siri@2026)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    onClick={() => {
                      setEmail(a.email);
                      setPassword("Siri@2026");
                    }}
                    className="text-left p-2.5 rounded-lg glass hover:glass-hover text-xs"
                  >
                    <div className="font-medium text-foreground truncate">{a.role}</div>
                    <div className="text-muted-foreground truncate text-[10px]">{a.email}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureMini({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="glass p-3 flex flex-col items-center gap-1.5 text-center">
      <div className="size-9 rounded-lg bg-teal/20 border border-teal/40 flex items-center justify-center text-teal-soft">
        <Icon className="size-4" />
      </div>
      <div className="text-[11px] font-medium text-foreground">{label}</div>
    </div>
  );
}
