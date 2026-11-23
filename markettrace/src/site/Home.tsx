import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BarChart3, Bell, Calculator, CalendarDays, Check, KanbanSquare, Lightbulb, Palette, Plug, Radar, Sparkles, Store, Users, Wallet,
} from "lucide-react";
import { useSiteSettings } from "../lib/site";
import { BrandMotion, HeroTrace } from "./BrandMotion";
import { InstallBlock } from "../app/Device";

export const MODULES = [
  { icon: Sparkles, title: "Super IA de marketing", text: "Ideias de posts, assuntos do momento no seu segmento, planos de campanha e análises, já sabendo quem é a sua empresa." },
  { icon: BarChart3, title: "Campanhas e métricas", text: "Investimento, receita e conversões por canal, com ROAS, CPL e CAC calculados sozinhos." },
  { icon: CalendarDays, title: "Agenda e agendamento", text: "Calendário do mês, agendamento de posts com pré-visualização e exportação para o Google Agenda." },
  { icon: Calculator, title: "Calculadoras de marketing", text: "ROI, ROAS, CAC, LTV, MER, CPL, conversão, markup, CPC e churn, com a fórmula ao lado." },
  { icon: KanbanSquare, title: "Rotinas e tarefas", text: "Quadro do time com responsável, prazo e etiqueta, do briefing à análise." },
  { icon: Wallet, title: "Orçamentos e custos", text: "Verba planejada x usada por mês e por categoria: mídia, eventos, ferramentas e ações." },
  { icon: Store, title: "Canais de venda", text: "Mercado Livre, Amazon e loja oficial: receita, taxas, frete e a margem que sobra de verdade." },
  { icon: Radar, title: "Pesquisa de mercado", text: "Ramo, objetivos, público-alvo, planejamento anual e radar de concorrentes." },
  { icon: Lightbulb, title: "Estúdio criativo", text: "Banco de ideias B2B e B2C com formato, canal e objetivo, pronto para virar pauta." },
  { icon: Users, title: "Equipe por empresa", text: "Editores e leitores com acesso só às empresas certas. Ideal para agências e diretorias." },
  { icon: Palette, title: "Identidade de cada empresa", text: "Logo, cores e fontes do cliente aplicadas no app, com contraste ajustado sozinho." },
  { icon: Plug, title: "Integração com seus apps", text: "CRM, automações e ERP recebem avisos na hora: post publicado, tarefa concluída, venda registrada." },
];

const STEPS = [
  { n: "01", title: "Ideia", text: "Super IA, estúdio criativo e pesquisa." },
  { n: "02", title: "Plano", text: "Campanhas, calendário e orçamento." },
  { n: "03", title: "Mídia", text: "Posts agendados e verba investida." },
  { n: "04", title: "Número", text: "ROAS, CPL, CAC e margem por canal." },
  { n: "05", title: "Decisão", text: "A próxima ação, com o número ao lado." },
];

const TICKER = ["ROAS", "CPL", "CAC", "LTV", "Agenda do mês", "Super IA", "Assuntos do momento", "Agendamento de posts", "Equipe por empresa", "Webhooks", "Margem por canal", "Orçamento x realizado", "Radar de concorrentes", "Google Agenda"];

/* ---------- utilidades de movimento ---------- */
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!("IntersectionObserver" in window)) { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

function CountUp({ to, decimals = 0, prefix = "", suffix = "", run }: { to: number; decimals?: number; prefix?: string; suffix?: string; run: boolean }) {
  const [v, setV] = useState(reduced() ? to : 0);
  useEffect(() => {
    if (!run || reduced()) { if (run) setV(to); return; }
    let raf = 0; const t0 = performance.now(); const dur = 1400;
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / dur); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return <>{prefix}{v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

/* ---------- vídeo opcional do topo (definido no backoffice) ---------- */
function HeroVideo({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (yt) return <iframe className="hero-video" src={`https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0&rel=0&playsinline=1`} title="Vídeo MarketTrace" allow="autoplay; encrypted-media; picture-in-picture" />;
  if (vimeo) return <iframe className="hero-video" src={`https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1&loop=1&background=1`} title="Vídeo MarketTrace" allow="autoplay; fullscreen" />;
  return <video className="hero-video" src={url} autoPlay muted loop playsInline />;
}

/* ---------- demonstração animada do produto ---------- */
function ProductDemo() {
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  const bars = [34, 52, 41, 63, 58, 77, 70, 92];
  return (
    <div className={`demo ${seen ? "in" : ""}`} ref={ref} aria-label="Demonstração do painel do MarketTrace com dados ilustrativos">
      <div className="demo-bar"><i /><i /><i /><span>markettrace.app · Visão geral</span></div>
      <div className="demo-body">
        <div className="demo-kpis">
          <div><span>ROAS</span><strong><CountUp to={4.8} decimals={1} suffix="×" run={seen} /></strong><em>+0,6</em></div>
          <div><span>CPL</span><strong><CountUp to={18.4} decimals={2} prefix="R$ " run={seen} /></strong><em className="down">−12%</em></div>
          <div><span>Receita</span><strong><CountUp to={96} prefix="R$ " suffix=" mil" run={seen} /></strong><em>+18%</em></div>
        </div>
        <div className="demo-chart">
          <svg viewBox="0 0 320 110" preserveAspectRatio="none" aria-hidden="true">
            {bars.map((h, i) => <rect key={i} className="demo-col" x={i * 40 + 8} width="24" y={110 - h} height={h} rx="4" style={{ transitionDelay: `${i * 70}ms` }} fill={i === bars.length - 1 ? "var(--sinal)" : "var(--mare)"} opacity={i === bars.length - 1 ? 1 : 0.28} />)}
            <path className="demo-line" d="M20 82 L60 66 L100 74 L140 50 L180 56 L220 34 L260 40 L300 14" fill="none" stroke="var(--tinta)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle className="demo-dot" cx="300" cy="14" r="5" fill="var(--sinal)" />
          </svg>
        </div>
        <div className="demo-row">
          <div className="demo-cal">
            <span className="data-label">Agenda · semana</span>
            <div className="demo-cal-grid">
              {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
                <div key={i}><small>{d}</small>{[1, 3, 4].includes(i) && <i className={`chip c${i}`} />}{i === 3 && <i className="chip c5" />}</div>
              ))}
            </div>
          </div>
          <div className="demo-ai">
            <span className="demo-ai-badge"><Sparkles size={13} /></span>
            <p><b>Super IA:</b> o Meta Ads teve o melhor retorno do mês. Que tal mover 15% da verba de Google para lá e testar 3 criativos novos?</p>
          </div>
        </div>
      </div>
      <span className="demo-note">Dados ilustrativos</span>
    </div>
  );
}

/* ---------- calculadora rápida (funciona sem cadastro) ---------- */
function QuickCalc() {
  const [inv, setInv] = useState("2000");
  const [rec, setRec] = useState("9600");
  const [conv, setConv] = useState("80");
  const n = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;
  const i = n(inv), r = n(rec), c = n(conv);
  const roas = i > 0 ? r / i : 0;
  const roi = i > 0 ? ((r - i) / i) * 100 : 0;
  const cpa = c > 0 ? i / c : 0;
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const leitura = !i || !r ? "Preencha investimento e receita."
    : roas >= 4 ? "Retorno forte: vale escalar a verba aos poucos e acompanhar o CPA."
    : roas >= 2 ? "Retorno positivo: teste criativos e públicos para subir o ROAS."
    : roas >= 1 ? "Empatando: revise oferta, público e página de destino antes de investir mais."
    : "Prejuízo: pause o que não converte e redistribua a verba.";
  return (
    <div className="qcalc">
      <div className="qcalc-in">
        <label className="field"><span>Investimento em mídia (R$)</span><input inputMode="decimal" value={inv} onChange={(e) => setInv(e.target.value)} /></label>
        <label className="field"><span>Receita gerada (R$)</span><input inputMode="decimal" value={rec} onChange={(e) => setRec(e.target.value)} /></label>
        <label className="field"><span>Vendas ou conversões</span><input inputMode="numeric" value={conv} onChange={(e) => setConv(e.target.value)} /></label>
      </div>
      <div className="qcalc-out" aria-live="polite">
        <div><span className="data-label">ROAS</span><strong>{roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}×</strong><small>receita ÷ investimento</small></div>
        <div><span className="data-label">ROI</span><strong className={roi < 0 ? "neg" : ""}>{roi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong><small>(receita − investimento) ÷ investimento</small></div>
        <div><span className="data-label">Custo por venda</span><strong>{brl(cpa)}</strong><small>investimento ÷ vendas</small></div>
        <p className="qcalc-read"><Check size={15} /> {leitura}</p>
      </div>
    </div>
  );
}

/* ---------- cartão de módulo: traço na borda, inclinação pelo cursor e ícone vivo ---------- */
function ModuleCard({ m, i }: { m: (typeof MODULES)[number]; i: number }) {
  const ref = useRef<HTMLElement>(null);
  const move = (e: React.MouseEvent) => {
    const el = ref.current; if (!el || reduced()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
  };
  const leave = () => { const el = ref.current; if (!el) return; el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); };
  return (
    <article ref={ref} className="module mod2" onMouseMove={move} onMouseLeave={leave} style={{ transitionDelay: `${(i % 3) * 60}ms` }}>
      <svg className="mod2-trace" aria-hidden="true"><rect x="1" y="1" rx="14" ry="14" pathLength={1} /></svg>
      <span className="module-icon"><m.icon size={20} strokeWidth={1.9} /></span>
      <ArrowUpRight className="mod2-arrow" size={18} aria-hidden="true" />
      <h3>{m.title}</h3>
      <p>{m.text}</p>
      <span className="mod2-bar" aria-hidden="true" />
    </article>
  );
}

/* ---------- vitrines de recursos ---------- */
function Showcase({ kicker, title, text, points, children, flip = false, tone = "surface" }: { kicker: string; title: string; text: string; points: string[]; children: React.ReactNode; flip?: boolean; tone?: "surface" | "ink" | "mare" | "polen" }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  return (
    <div ref={ref} className={`show ${flip ? "flip" : ""} ${seen ? "in" : ""}`}>
      <div className="show-copy">
        <span className="kicker">{kicker}</span>
        <h3>{title}</h3>
        <p>{text}</p>
        <ul>{points.map((p) => <li key={p}><Check size={16} /> {p}</li>)}</ul>
      </div>
      <div className={`show-art art-${tone}`} aria-hidden="true">{children}</div>
    </div>
  );
}

export default function Home() {
  const s = useSiteSettings();
  const [flowRef, flowSeen] = useInView<HTMLDivElement>(0.3);
  const video = s.hero_video_url?.trim();
  return (
    <div className="home">
      <section className="hero-wrap">
      <HeroTrace />
      <div className="hero2">
        <div className="hero2-copy">
          <span className="kicker">Plataforma de marketing · do dado à decisão</span>
          <h1 className="display">{s.hero_titulo.replace(/\.$/, "")}<span className="signal-dot">.</span></h1>
          <p className="hero-sub">{s.hero_subtitulo}</p>
          <div className="hero-actions">
            <Link to="/cadastro" className="btn btn-primary btn-lg">Começar grátis <ArrowRight size={18} /></Link>
            <Link to="/funcionalidades" className="btn btn-ghost btn-lg">Ver como funciona</Link>
          </div>
          <ul className="hero-proof">
            <li><Check size={15} /> 14 dias de teste grátis</li>
            <li><Check size={15} /> Sem cartão para começar</li>
            <li><Check size={15} /> Feito no Brasil, em português</li>
          </ul>
        </div>
        <div className="hero2-art">
          {video ? <div className="hero-video-wrap"><HeroVideo url={video} /></div> : <ProductDemo />}
        </div>
      </div>
      </section>

      <div className="ticker ticker-polen" aria-hidden="true">
        <div className="ticker-track">{[...TICKER, ...TICKER].map((t, i) => <span key={i}>{t}<i>•</i></span>)}</div>
      </div>

      <section className="band band-ink">
        <div className="section">
        <div className="section-head">
          <span className="kicker">Como funciona</span>
          <h2>Um ciclo só, do primeiro rascunho ao resultado.</h2>
        </div>
        <div className={`flow3 ${flowSeen ? "in" : ""}`} ref={flowRef}>
          <div className="flow3-track" aria-hidden="true">
            <span className="flow3-line" />
            {STEPS.map((st, i) => <span key={st.n} className="flow3-node" style={{ "--i": i } as React.CSSProperties} />)}
            <span className="flow3-run" />
          </div>
          {STEPS.map((st, i) => (
            <div className="flow2-step" key={st.n} style={{ transitionDelay: `${200 + i * 160}ms`, "--i": i } as React.CSSProperties}>
              <span className="data-label">{st.n}</span>
              <strong>{st.title}</strong>
              <p>{st.text}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="kicker">Feito para a correria</span>
          <h2>Menos abas abertas. Mais tempo para criar e decidir.</h2>
        </div>
        <div className="shows">
          <Showcase tone="ink" kicker="Super IA" title="Uma especialista em marketing ao seu lado." text="Ela já conhece a empresa, o segmento e o público. Você pede, ela entrega pronto para executar."
            points={["Ideias de posts com formato, gancho e legenda", "Assuntos em alta no seu segmento, com as fontes", "Planos de campanha com canais, verba e indicadores"]}>
            <div className="art-chat">
              <div className="q">Assuntos em alta no meu segmento esta semana?</div>
              <div className="a"><span><Sparkles size={13} /></span><div><b>3 pautas para agora</b><i /><i /><i className="short" /><em>Fontes: 3 links</em></div></div>
            </div>
          </Showcase>
          <Showcase flip kicker="Agenda" title="O mês inteiro em uma tela." text="Pautas, posts agendados e publicados no calendário, com a cor do status. Um clique para anotar uma ideia no dia certo."
            points={["Visão de mês e de semana", "Agendamento com pré-visualização do post", "Exporta para o Google Agenda"]}>
            <div className="art-month">{Array.from({ length: 35 }, (_, i) => <div key={i} className={i === 17 ? "today" : ""}>{[3, 8, 10, 15, 17, 22, 24, 29].includes(i) && <i className={`s${i % 4}`} />}{[10, 24].includes(i) && <i className="s1" />}</div>)}</div>
          </Showcase>
          <Showcase tone="mare" kicker="Números" title="Cada real investido com o retorno ao lado." text="Lance investimento e receita por canal e o MarketTrace calcula o resto. Sem planilha solta."
            points={["ROAS, ROI, CPL e CAC automáticos", "Orçamento planejado x usado por categoria", "Margem real por canal de venda, já sem taxas e frete"]}>
            <div className="art-bars">{[["Meta Ads", 86], ["Google Ads", 58], ["E-mail", 41], ["Orgânico", 30]].map(([l, v]) => <div key={l as string}><span>{l}</span><i style={{ width: `${v}%` }} /></div>)}</div>
          </Showcase>
          <Showcase flip tone="polen" kicker="Times e agências" title="Cada pessoa na empresa certa." text="Convide o time por empresa, com papel de editor ou leitor. Cada cliente com a própria logo, cores e fontes."
            points={["Até 8 pessoas por empresa, sem limite nas contas ilimitadas", "Gestores e diretoria acompanham sem mexer", "Avisos automáticos para o CRM e as automações da empresa"]}>
            <div className="art-team">{["Editor", "Editor", "Leitor", "Leitor"].map((p, i) => <div key={i}><span className={`av a${i}`} /><i /><em>{p}</em></div>)}</div>
          </Showcase>
        </div>
      </section>

      <section className="band band-mare">
        <div className="section">
        <div className="section-head">
          <span className="kicker">Teste agora, sem cadastro</span>
          <h2>Sua campanha está dando retorno?</h2>
          <p className="muted">Coloque os números da última campanha. Dentro do MarketTrace são 10 calculadoras, com histórico por empresa.</p>
        </div>
        <QuickCalc />
        </div>
      </section>

      <section className="section app-sec">
        <div className="app-copy">
          <span className="kicker">No seu bolso</span>
          <h2>O MarketTrace no celular, avisando na hora certa.</h2>
          <p className="muted">Instale o app direto do navegador, sem loja e sem ocupar espaço, e ligue as notificações de cada empresa.</p>
          <ul className="app-list">
            <li><Bell size={16} /> <span><strong>Hora de publicar:</strong> o aviso chega quando o post agendado está na hora.</span></li>
            <li><Bell size={16} /> <span><strong>Tarefas do dia:</strong> um resumo às 9h com o que vence hoje.</span></li>
            <li><Bell size={16} /> <span><strong>Suporte:</strong> a resposta do seu chamado assim que chega.</span></li>
          </ul>
          <div className="app-install"><InstallBlock /></div>
        </div>
        <div className="phone" aria-hidden="true">
          <div className="phone-screen">
            <div className="phone-time">09:00</div>
            <div className="phone-note n1"><span className="pn-ico" /><div><b>Hora de publicar · MCI Store</b><small>Reels: bastidores da gravação</small></div></div>
            <div className="phone-note n2"><span className="pn-ico" /><div><b>Tarefas de hoje</b><small>3 tarefas vencem hoje.</small></div></div>
            <div className="phone-note n3"><span className="pn-ico" /><div><b>Resposta do suporte</b><small>Seu chamado foi respondido.</small></div></div>
          </div>
        </div>
      </section>

      <section className="band band-nevoa2">
        <div className="section">
        <div className="section-head">
          <span className="kicker">Tudo em um lugar</span>
          <h2>O que completa o dia a dia do marketing.</h2>
        </div>
        <div className="module-grid mod2-grid">
          {MODULES.map((m, i) => <ModuleCard key={m.title} m={m} i={i} />)}
        </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="kicker">Para quem é</span>
          <h2>Para quem cria, para quem analisa e para quem decide.</h2>
        </div>
        <div className="audience-grid">
          <div><h3>Agências</h3><p>Um espaço por cliente, com a equipe certa, a identidade da marca e os números separados.</p></div>
          <div><h3>Profissionais autônomos</h3><p>Calculadoras, agenda, Super IA e orçamento sem cinco ferramentas abertas ao mesmo tempo.</p></div>
          <div><h3>Times internos e diretorias</h3><p>Verba, campanhas, canais de venda e concorrência lado a lado, com a decisão no fim da linha.</p></div>
        </div>
      </section>

      <section className="brand-band">
        <BrandMotion />
        <div className="cta cta-ink">
        <h2>Ideia boa precisa de rota.</h2>
        <p>Crie sua conta, cadastre suas empresas e veja campanhas, conteúdo e resultados lado a lado em poucos minutos.</p>
        <div className="hero-actions">
          <Link to="/cadastro" className="btn btn-primary btn-lg">Começar grátis <ArrowRight size={18} /></Link>
          <Link to="/planos" className="btn btn-light btn-lg">Ver planos</Link>
        </div>
        </div>
      </section>
    </div>
  );
}
