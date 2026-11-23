import { useEffect, useRef, useState } from "react";

/** Logomarca em movimento: a linha de dados chega, desenha o M, o ponto (Sinal) cai e a linha segue subindo como um gráfico. */
export function BrandMotion({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // M da marca (mesmo desenho do símbolo), escalado: (x, y) -> (470 + 3.2x, 40 + 3.2y)
  const M = "M508.4 193.6V94.4l44.8 44.8 44.8-44.8v67.2q0 32 25.6 32";
  const entrada = "M0 193.6H120l40-26 46 52 42-38 40 20 44-30 52 22H508.4";
  const saida = "M657 193.6l58-22 56 14 62-52 58 18 70-70 64 16 92-82 83-18";
  const nos = [[715, 171.6], [771, 185.6], [833, 133.6], [891, 151.6], [961, 81.6], [1025, 97.6], [1117, 15.6]];
  const word = "markettrace";
  return (
    <div ref={ref} className={`bm ${compact ? "bm-compact" : ""} ${on ? "on" : ""}`} aria-label="MarketTrace">
      <svg className="bm-svg" viewBox="0 0 1200 230" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <pattern id="bm-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="currentColor" /></pattern>
        </defs>
        <rect className="bm-grid" x="0" y="0" width="1200" height="230" fill="url(#bm-grid)" />
        <line className="bm-scan" x1="0" y1="0" x2="0" y2="230" />
        <path className="bm-in" d={entrada} pathLength={1} />
        <path className="bm-m" d={M} pathLength={1} />
        <path className="bm-out" d={saida} pathLength={1} />
        {nos.map(([x, y], i) => <circle key={i} className="bm-node" cx={x} cy={y} r="5" style={{ animationDelay: `${0.0 + i * 0.12}s` }} />)}
        <circle className="bm-dot" cx="657.2" cy="193.6" r="14.4" />
      </svg>
      <div className="bm-word" aria-hidden="true">
        {word.split("").map((c, i) => <span key={i} style={{ animationDelay: `${i * 0.05}s` }}>{c}</span>)}
        <span className="bm-word-dot">.</span>
      </div>
      {!compact && (
        <div className="bm-chips" aria-hidden="true">
          <span className="c1">ROAS ↑ 4,8×</span>
          <span className="c2">CPL ↓ 12%</span>
          <span className="c3">Posts agendados · 12</span>
          <span className="c4">Super IA · 3 pautas</span>
        </div>
      )}
    </div>
  );
}

/** Fundo vivo do topo: malha de pontos, linha de dados se desenhando e o ponto (Sinal) percorrendo a linha. */
export function HeroTrace() {
  const d = "M-20 628 C 120 628, 170 606, 260 614 S 420 636, 520 618 S 700 590, 800 604 S 980 616, 1060 592 S 1240 560, 1460 540";
  return (
    <div className="hero-trace" aria-hidden="true">
      <svg viewBox="0 0 1440 640" preserveAspectRatio="xMidYMax slice">
        <defs>
          <pattern id="ht-grid" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="currentColor" /></pattern>
        </defs>
        <rect className="ht-grid" x="728" y="0" width="760" height="640" fill="url(#ht-grid)" />
        <path className="ht-line" d={d} pathLength={1} />
        {[[260, 614], [520, 618], [800, 604], [1060, 592]].map(([x, y], i) => <circle key={i} className="ht-node" cx={x} cy={y} r="6" style={{ animationDelay: `${0.4 + i * 0.5}s` }} />)}
        <circle className="ht-run" r="8">
          <animateMotion dur="7s" repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
        </circle>
      </svg>
      <span className="ht-chip k1">Agenda · 4 posts hoje</span>
      <span className="ht-chip k2">ROAS 4,8×</span>
    </div>
  );
}
