import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/lib/auth/authConfig";

/* â”€â”€ Revenue Chart Streams canvas â”€â”€ */
function RevenueCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    // Chart line config
    const CHARTS = [
      { baseY: 0.28, amp: 0.09, freq1: 0.018, freq2: 0.041, freq3: 0.007, color: "145,170,157", lineW: 1.5, speed: 1.0 },
      { baseY: 0.52, amp: 0.07, freq1: 0.012, freq2: 0.033, freq3: 0.005, color: "209,219,189", lineW: 1.2, speed: 0.7 },
      { baseY: 0.72, amp: 0.11, freq1: 0.022, freq2: 0.055, freq3: 0.009, color: "62,96,111",   lineW: 1.8, speed: 1.3 },
      { baseY: 0.42, amp: 0.05, freq1: 0.030, freq2: 0.020, freq3: 0.011, color: "145,170,157", lineW: 0.8, speed: 0.5 },
    ];

    // Scrolling Y-value buffers â€” one value per horizontal pixel
    let bufs: Float32Array[] = [];
    let t = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      bufs = CHARTS.map((c) => {
        const buf = new Float32Array(canvas.width);
        for (let x = 0; x < canvas.width; x++) {
          buf[x] = c.baseY * canvas.height
            + Math.sin(x * c.freq1) * c.amp * canvas.height
            + Math.sin(x * c.freq2) * c.amp * 0.4 * canvas.height;
        }
        return buf;
      });
    };

    // Smooth noise: sum of sine waves â€” mimics real revenue data movement
    const nextY = (c: typeof CHARTS[0], t: number) =>
      c.baseY * canvas.height
      + Math.sin(t * c.freq1 * 40)  * c.amp * canvas.height
      + Math.sin(t * c.freq2 * 18)  * c.amp * 0.45 * canvas.height
      + Math.sin(t * c.freq3 * 110) * c.amp * 0.2  * canvas.height;

    const draw = () => {
      t += 0.012;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      /* â”€â”€ Subtle grid â”€â”€ */
      const GRID = 55;
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "rgba(145,170,157,0.05)";
      for (let x = 0; x < canvas.width; x += GRID) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += GRID) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      /* â”€â”€ Horizontal tick labels (faint) â”€â”€ */
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(145,170,157,0.12)";
      for (let y = GRID; y < canvas.height; y += GRID) {
        const label = `$${Math.round((canvas.height - y) / canvas.height * 2400)}K`;
        ctx.fillText(label, 8, y - 3);
      }

      /* â”€â”€ Scroll each buffer left, append new right-edge value â”€â”€ */
      CHARTS.forEach((c, i) => {
        const buf = bufs[i];
        buf.copyWithin(0, 1);                        // shift left
        buf[buf.length - 1] = nextY(c, t * c.speed); // new value

        const W = canvas.width;
        const H = canvas.height;

        /* Gradient fill under line */
        const grad = ctx.createLinearGradient(0, c.baseY * H - c.amp * H, 0, H);
        grad.addColorStop(0, `rgba(${c.color},0.12)`);
        grad.addColorStop(0.6, `rgba(${c.color},0.04)`);
        grad.addColorStop(1, `rgba(${c.color},0)`);

        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, buf[0]);
        for (let x = 1; x < W - 1; x++) {
          const mx = x + 0.5;
          const my = (buf[x] + buf[x + 1]) / 2;
          ctx.quadraticCurveTo(x, buf[x], mx, my);
        }
        ctx.lineTo(W, buf[W - 1]);
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        /* Line */
        ctx.beginPath();
        ctx.moveTo(0, buf[0]);
        for (let x = 1; x < W - 1; x++) {
          const mx = x + 0.5;
          const my = (buf[x] + buf[x + 1]) / 2;
          ctx.quadraticCurveTo(x, buf[x], mx, my);
        }
        ctx.lineTo(W, buf[W - 1]);
        ctx.strokeStyle = `rgba(${c.color},0.55)`;
        ctx.lineWidth = c.lineW;
        ctx.stroke();

        /* Glowing leading dot at right edge */
        const ex = W - 1;
        const ey = buf[W - 1];

        const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 12);
        glow.addColorStop(0, `rgba(${c.color},0.7)`);
        glow.addColorStop(1, `rgba(${c.color},0)`);
        ctx.beginPath();
        ctx.arc(ex, ey, 12, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.color},1)`;
        ctx.fill();

        /* Pulsing ring on leading dot */
        const pulse = ((Math.sin(t * 3 + i * 1.5) + 1) / 2) * 8 + 4;
        ctx.beginPath();
        ctx.arc(ex, ey, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.color},${0.3 - pulse * 0.02})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });

      animId = requestAnimationFrame(draw);
    };

    resize();
    draw();

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/* â”€â”€ Login page â”€â”€ */
export function LoginPage() {
  const { instance } = useMsal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    setLoading(true);
    try {
      // Navigates to Azure AD; the page won't continue past this call.
      // On return, main.tsx processes handleRedirectPromise() before rendering.
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden" style={{ background: "#0D1B2A" }}>

      {/* Revenue chart streams */}
      <RevenueCanvas />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -left-40 top-1/3 h-[500px] w-[500px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #1a3a5c 0%, transparent 70%)", filter: "blur(80px)" }}
        />
        <div
          className="absolute bottom-0 right-1/4 h-[400px] w-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #3E606F 0%, transparent 70%)", filter: "blur(100px)" }}
        />
      </div>

      {/* Left panel */}
      <div className="relative z-10 hidden flex-col justify-between p-14 lg:flex lg:w-[58%]">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3"
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: "rgba(145,170,157,0.1)", border: "1px solid rgba(145,170,157,0.2)" }}
          >
            <span className="text-xs font-bold" style={{ color: "#91AA9D" }}>AS</span>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "rgba(145,170,157,0.55)" }}>
            Acquire Tax Credits
          </span>
        </motion.div>

        <div className="max-w-xl">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-5 text-xs font-semibold uppercase tracking-[0.3em]"
            style={{ color: "#91AA9D" }}
          >
            Enterprise Sales Platform
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="font-black uppercase leading-[1.0] tracking-tight"
            style={{ color: "#FCFFF5", fontSize: "clamp(2.6rem,4.5vw,4.2rem)" }}
          >
            THE NEW<br />
            STANDARD<br />
            IN&nbsp;&nbsp;R&amp;D TAX<br />
            BILLING.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-6 max-w-sm text-sm leading-relaxed"
            style={{ color: "rgba(209,219,189,0.5)" }}
          >
            Streamline multi-entity R&D tax credit calculations, client billing,
            and engagement tracking in one secure workspace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 flex flex-wrap gap-3"
          >
            {["Multi-Entity Billing", "Real-Time Calculations", "Secure Workspace"].map((chip) => (
              <div
                key={chip}
                className="rounded-full px-4 py-1.5 text-xs"
                style={{
                  background: "rgba(145,170,157,0.06)",
                  border: "1px solid rgba(145,170,157,0.14)",
                  color: "#91AA9D",
                }}
              >
                {chip}
              </div>
            ))}
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-[11px] uppercase tracking-widest"
          style={{ color: "rgba(145,170,157,0.2)" }}
        >
          Â© {new Date().getFullYear()} Acquire Tax Credits
        </motion.p>
      </div>

      {/* Right panel â€” form */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-8">
        <div
          className="absolute bottom-0 left-0 top-0 hidden w-px lg:block"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(145,170,157,0.1) 30%, rgba(145,170,157,0.1) 70%, transparent)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-[360px]"
        >
          <div
            className="rounded-2xl p-8"
            style={{
              background: "rgba(13,27,42,0.82)",
              border: "1px solid rgba(145,170,157,0.1)",
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
            }}
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#FCFFF5" }}>
                Sign in
              </h2>
              <p className="mt-1.5 text-sm" style={{ color: "rgba(145,170,157,0.55)" }}>
                Access your billing workspace.
              </p>
            </div>

            <div className="space-y-4">
              {error && (
                <div
                  className="rounded-lg px-4 py-2.5 text-xs"
                  style={{
                    background: "rgba(220,50,50,0.08)",
                    border: "1px solid rgba(220,50,50,0.2)",
                    color: "#ff8080",
                  }}
                >
                  {error}
                </div>
              )}

              <Button
                type="button"
                onClick={signIn}
                disabled={loading}
                className="mt-2 h-11 w-full rounded-lg text-sm font-semibold tracking-wide transition-opacity hover:opacity-90"
                style={{ background: "#3E606F", color: "#FCFFF5" }}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </div>
          </div>

          <p
            className="mt-5 text-center text-[11px] uppercase tracking-widest"
            style={{ color: "rgba(145,170,157,0.2)" }}
          >
            Azure AD / MSAL ready
          </p>
        </motion.div>
      </div>
    </div>
  );
}


