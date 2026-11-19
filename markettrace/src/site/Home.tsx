import { Link } from "react-router-dom";
import {
  ArrowRight, BarChart3, Calculator, CalendarDays, KanbanSquare, Lightbulb, Plug, Radar, Store, Wallet,
} from "lucide-react";
import { useSiteSettings } from "../lib/site";

export const MODULES = [
  { icon: Calculator, title: "Calculadoras de marketing", text: "ROI, ROAS, CAC, LTV, MER, CPL, conversão, markup, CPC e churn, com a fórmula ao lado de cada resultado." },
  { icon: BarChart3, title: "Campanhas e métricas", text: "Lance investimento, receita e conversões por canal e acompanhe o período em uma visão só." },
  { icon: CalendarDays, title: "Agenda editorial", text: "Calendário por rede social, status de cada conteúdo, ranking dos posts e os melhores horários do seu histórico." },
  { icon: KanbanSquare, title: "Rotinas e tarefas", text: "Quadro de tarefas do time com responsável, prazo e etiqueta, do briefing à análise." },
  { icon: Wallet, title: "Orçamentos e custos", text: "Verba planejada x usada por mês e por categoria: mídia, eventos, ferramentas, ações internas e externas." },
  { icon: Store, title: "Canais de venda", text: "Mercado Livre, Amazon e loja oficial: receita, taxas, frete e a margem que sobra de verdade." },
  { icon: Lightbulb, title: "Estúdio criativo", text: "Banco de ideias B2B e B2C com formato, canal e objetivo, pronto para virar pauta ou tarefa." },
  { icon: Radar, title: "Pesquisa de mercado", text: "Ramo, objetivos da marca, planejamento anual ou semestral, público-alvo e radar de concorrentes." },
  { icon: Plug, title: "Integrações", text: "Redes sociais, anúncios e marketplaces conectados ao fluxo. Em desenvolvimento, uma de cada vez." },
];

const STEPS = [
  { n: "01", title: "Ideia", text: "Estúdio criativo e pesquisa de mercado." },
  { n: "02", title: "Plano", text: "Campanhas, agenda e orçamento do mês." },
  { n: "03", title: "Mídia", text: "Conteúdo publicado e verba investida." },
  { n: "04", title: "Número", text: "Métricas, calculadoras e canais de venda." },
  { n: "05", title: "Ação", text: "A próxima decisão, com o número ao lado." },
];

export default function Home() {
  const s = useSiteSettings();
  return (
    <>
      <section className="hero">
        <span className="kicker">Para profissionais, times e diretorias de marketing</span>
        <h1 className="display">{s.hero_titulo.replace(/\.$/, "")}<span className="signal-dot">.</span></h1>
        <p className="hero-sub">{s.hero_subtitulo}</p>
        <div className="hero-actions">
          <Link to="/cadastro" className="btn btn-primary btn-lg">Começar agora <ArrowRight size={18} /></Link>
          <Link to="/funcionalidades" className="btn btn-ghost btn-lg">Ver como funciona</Link>
        </div>
      </section>

      <section className="flow-section">
        <div className="flow">
          <svg className="flow-line" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 20H960" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="980" cy="20" r="9" fill="var(--sinal)" />
          </svg>
          {STEPS.map((st) => (
            <div className="flow-step" key={st.n}>
              <span className="data-label">{st.n}</span>
              <strong>{st.title}</strong>
              <p>{st.text}</p>
            </div>
          ))}
        </div>
        <p className="flow-caption">Marketing é movimento: ideia que vira plano, plano que vira mídia, mídia que vira número — e número que volta a virar ideia. O MarketTrace existe para que esse ciclo não perca força no caminho.</p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="kicker">O que tem dentro</span>
          <h2>Tudo o que completa o dia a dia do marketing, no mesmo lugar.</h2>
        </div>
        <div className="module-grid">
          {MODULES.map((m) => (
            <article className="module" key={m.title}>
              <m.icon size={22} strokeWidth={1.8} />
              <h3>{m.title}</h3>
              <p>{m.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-ink">
        <div className="section-head">
          <span className="kicker">Para quem é</span>
          <h2>Para quem cria, para quem analisa e para quem decide.</h2>
        </div>
        <div className="audience-grid">
          <div><h3>Agências</h3><p>Um workspace para cada cliente, com a equipe certa em cada um e os números separados.</p></div>
          <div><h3>Profissionais autônomos</h3><p>Calculadoras, agenda, orçamento e relatórios sem planilha solta e sem cinco ferramentas abertas.</p></div>
          <div><h3>Times internos e diretorias</h3><p>Verba do mês, campanhas, canais de venda e concorrência lado a lado, com a decisão no fim da linha.</p></div>
        </div>
      </section>

      <section className="section cta">
        <h2>Ideia boa precisa de rota.</h2>
        <p>Crie sua conta, cadastre suas empresas e comece pelo que dói mais hoje.</p>
        <div className="hero-actions">
          <Link to="/planos" className="btn btn-primary btn-lg">Ver planos <ArrowRight size={18} /></Link>
          <Link to="/contato" className="btn btn-ghost btn-lg">Falar com a Evelyn</Link>
        </div>
      </section>
    </>
  );
}
