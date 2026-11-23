import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ExternalLink, Instagram, Linkedin, Mail, MessageCircle } from "lucide-react";
import { EmptyState, Loading, Notice, Tabs } from "../components/ui";
import { useRows } from "../lib/data";
import { money } from "../lib/format";
import { instagramUrl, useSiteSettings } from "../lib/site";
import { configured, errorMessage, supabase } from "../lib/supabase";
import { MODULES } from "./Home";

/* ---------------- Funcionalidades ---------------- */
const DETAILS: Record<string, string[]> = {
  "Calculadoras de marketing": ["Fórmula e explicação ao lado de cada indicador", "Markup para marketplace considerando taxas, impostos e margem", "Valores em reais e percentuais no padrão brasileiro"],
  "Campanhas e métricas": ["Campanhas com objetivo, canal, período e verba", "Lançamento de métricas por dia e por canal", "ROAS, CPL e CAC calculados automaticamente"],
  "Agenda editorial": ["Semana a semana, por rede social", "Status: ideia, rascunho, aprovado, agendado e publicado", "Ranking e melhores horários a partir dos seus resultados"],
  "Rotinas e tarefas": ["Quadro A fazer · Em andamento · Concluído", "Responsável, prazo e etiqueta", "Ideias do estúdio viram tarefas com um clique"],
  "Orçamentos e custos": ["Planejado x realizado por categoria", "Visão do mês inteiro de uma vez", "Custos ligados às campanhas"],
  "Canais de venda": ["Receita, pedidos, taxas e frete por canal", "Margem líquida depois das taxas", "Comparativo entre marketplaces e loja oficial"],
  "Estúdio criativo": ["Ideias separadas em B2B e B2C", "Formato, canal, objetivo e motivo de cada ideia", "Fluxo: nova → em briefing → aprovada"],
  "Pesquisa de mercado": ["Ramo de atuação e objetivos da marca", "Planejamento anual (Q1–Q4) ou semestral", "Concorrentes com @ do Instagram e site oficial"],
  "Integrações": ["Instagram, TikTok, LinkedIn, YouTube e Pinterest", "Meta Ads, Google Ads e TikTok Ads", "Mercado Livre, Amazon e Google Agenda"],
};

export function Features() {
  return (
    <>
      <section className="hero hero-small">
        <span className="kicker">Funcionalidades</span>
        <h1 className="display-sm">Um traço só, do sinal à ação<span className="signal-dot">.</span></h1>
        <p className="hero-sub">Cada módulo do MarketTrace resolve uma parte do trabalho, e todos falam a mesma língua: o número aparece ao lado da decisão que ele sustenta.</p>
      </section>
      <section className="section">
        <div className="feature-list">
          {MODULES.map((m, i) => (
            <article className="feature-row" key={m.title}>
              <span className="data-label">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2><m.icon size={22} strokeWidth={1.8} /> {m.title}</h2>
                <p>{m.text}</p>
              </div>
              <ul>{DETAILS[m.title]?.map((d) => <li key={d}><Check size={15} /> {d}</li>)}</ul>
            </article>
          ))}
        </div>
        <p className="muted center">As integrações com redes sociais, anúncios e marketplaces estão em desenvolvimento. Até lá, os dados são lançados no próprio app.</p>
        <div className="center"><Link to="/planos" className="btn btn-primary btn-lg">Ver planos <ArrowRight size={18} /></Link></div>
      </section>
    </>
  );
}

/* ---------------- Planos ---------------- */
type Plan = { id: string; nome: string; descricao: string | null; preco_mensal: number; preco_anual: number | null; limite_empresas: number | null; limite_usuarios: number | null; recursos: string[]; destaque: boolean };

export function Plans() {
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");
  const { rows, loading } = useRows<Plan>({ table: "plans", eq: { ativo: true }, order: ["ordem"] });
  const hasAnnual = rows.some((p) => p.preco_anual);
  return (
    <>
      <section className="hero hero-small">
        <span className="kicker">Planos</span>
        <h1 className="display-sm">Escolha o tamanho do seu fluxo<span className="signal-dot">.</span></h1>
        <p className="hero-sub">Toda conta começa com 14 dias de teste grátis. Sem cartão: a ativação é feita pela nossa equipe.</p>
        {hasAnnual && <Tabs value={ciclo} onChange={setCiclo} items={[{ value: "mensal", label: "Mensal" }, { value: "anual", label: "Anual" }]} />}
      </section>
      <section className="section">
        {loading ? <Loading /> : rows.length === 0 ? (
          <EmptyState title="Os planos estão sendo definidos" text="Enquanto isso, fale com a gente para conhecer o MarketTrace e combinar o melhor formato para você." action={<Link to="/contato" className="btn btn-primary">Falar com o suporte</Link>} />
        ) : (
          <div className="plan-grid">
            {rows.map((p) => {
              const anual = ciclo === "anual" && p.preco_anual;
              return (
                <article key={p.id} className={`plan ${p.destaque ? "plan-featured" : ""}`}>
                  {p.destaque && <span className="badge badge-signal">Mais escolhido</span>}
                  <h2>{p.nome}</h2>
                  {p.descricao && <p>{p.descricao}</p>}
                  <div className="plan-price">
                    <strong>{money(anual ? p.preco_anual! / 12 : p.preco_mensal)}</strong><span>/mês</span>
                  </div>
                  {anual && <small className="muted">{money(p.preco_anual)} cobrados por ano</small>}
                  <ul>
                    <li><Check size={15} /> {p.limite_empresas ? `Até ${p.limite_empresas} empresa(s)` : "Empresas ilimitadas"}</li>
                    <li><Check size={15} /> {p.limite_usuarios ? `Até ${p.limite_usuarios} usuário(s)` : "Usuários ilimitados"}</li>
                    {p.recursos?.map((r) => <li key={r}><Check size={15} /> {r}</li>)}
                  </ul>
                  <Link to={`/cadastro?plano=${p.id}&ciclo=${anual ? "anual" : "mensal"}`} className={`btn ${p.destaque ? "btn-primary" : "btn-ghost"}`}>Assinar</Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

/* ---------------- Contato + portfólio ---------------- */
export function Contact() {
  const s = useSiteSettings();
  const { rows: plans } = useRows<Plan>({ table: "plans", eq: { ativo: true }, order: ["ordem"] });
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", empresa: "", plano_interesse: "", mensagem: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured) { setError("O formulário ainda não está ligado ao banco de dados. Use o e-mail ou o WhatsApp ao lado."); return; }
    setState("sending"); setError("");
    const { error: err } = await supabase.from("contact_leads").insert({
      ...form, telefone: form.telefone || null, empresa: form.empresa || null, plano_interesse: form.plano_interesse || null,
    });
    if (err) { setError(errorMessage(err)); setState("idle"); } else setState("sent");
  };

  return (
    <>
      <section className="hero hero-small">
        <span className="kicker">Contato</span>
        <h1 className="display-sm">Vamos conversar<span className="signal-dot">.</span></h1>
        <p className="hero-sub">Dúvidas, demonstração, planos para agência ou time interno: mande uma mensagem e eu respondo pessoalmente.</p>
      </section>
      <section className="section contact-grid">
        <div className="panel">
          {state === "sent" ? (
            <EmptyState title="Mensagem enviada!" text="Recebi seu contato e respondo em até 1 dia útil, pelo e-mail ou WhatsApp que você informou." />
          ) : (
            <form className="form-grid" onSubmit={send}>
              <label className="field half"><span>Nome *</span><input required value={form.nome} onChange={set("nome")} /></label>
              <label className="field half"><span>E-mail *</span><input required type="email" value={form.email} onChange={set("email")} /></label>
              <label className="field half"><span>WhatsApp</span><input value={form.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" /></label>
              <label className="field half"><span>Empresa</span><input value={form.empresa} onChange={set("empresa")} /></label>
              {plans.length > 0 && (
                <label className="field full"><span>Plano de interesse</span>
                  <select value={form.plano_interesse} onChange={set("plano_interesse")}>
                    <option value="">Ainda não sei</option>
                    {plans.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  </select>
                </label>
              )}
              <label className="field full"><span>Mensagem *</span><textarea required rows={5} value={form.mensagem} onChange={set("mensagem")} /></label>
              <div className="full"><Notice tone="error">{error}</Notice></div>
              <p className="full muted small">Ao enviar, você concorda com o uso desses dados para responder ao seu contato, conforme a <Link to="/privacidade">política de privacidade</Link>.</p>
              <div className="full"><button className="btn btn-primary" disabled={state === "sending"}>{state === "sending" ? "Enviando…" : "Enviar mensagem"}</button></div>
            </form>
          )}
        </div>
        <aside className="contact-card">
          <img src="/brand/evelyn-light.png" alt={s.contato_nome} className="contact-logo" />
          <h2>{s.contato_nome}</h2>
          <p>{s.contato_cargo}</p>
          <a href={`mailto:${s.contato_email}`}><Mail size={16} /> {s.contato_email}</a>
          {s.contato_whatsapp_link && <a href={s.contato_whatsapp_link} target="_blank" rel="noreferrer"><MessageCircle size={16} /> {s.contato_whatsapp}</a>}
          {s.contato_instagram && <a href={instagramUrl(s.contato_instagram)} target="_blank" rel="noreferrer"><Instagram size={16} /> {s.contato_instagram}</a>}
          {s.contato_linkedin && <a href={s.contato_linkedin} target="_blank" rel="noreferrer"><Linkedin size={16} /> LinkedIn</a>}
          {s.portfolio_link && <a href={s.portfolio_link} target="_blank" rel="noreferrer" className="btn btn-light">Ver portfólio completo <ExternalLink size={15} /></a>}
        </aside>
      </section>
      {s.portfolio.length > 0 && (
        <section className="section">
          <div className="section-head"><span className="kicker">Portfólio</span><h2>Trabalhos selecionados</h2></div>
          <div className="portfolio-grid">
            {s.portfolio.map((item) => (
              <article className="portfolio-item" key={item.titulo}>
                {item.imagem_url && <img src={item.imagem_url} alt={item.titulo} loading="lazy" />}
                <h3>{item.titulo}</h3>
                {item.descricao && <p>{item.descricao}</p>}
                {item.link && <a href={item.link} target="_blank" rel="noreferrer">Ver projeto <ExternalLink size={14} /></a>}
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ---------------- Política de privacidade (LGPD) ---------------- */
export function Privacy() {
  const s = useSiteSettings();
  return (
    <section className="section prose">
      <span className="kicker">Versão 1.0 · novembro de 2026</span>
      <h1>Política de Privacidade</h1>
      <p>Esta política explica como o MarketTrace trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). A controladora dos dados é {s.contato_nome}, responsável pelo MarketTrace.</p>
      <h2>1. Quais dados tratamos</h2>
      <p>Dados de cadastro (nome, e-mail, telefone), dados de acesso (login e registros de uso), informações das contas e empresas cadastradas, mensagens enviadas pelo formulário de contato e pelo suporte, e os dados de marketing que cada cliente decide lançar na plataforma (campanhas, métricas, custos, conteúdos, tarefas, ideias e concorrentes).</p>
      <h2>2. Para que usamos</h2>
      <p>Para criar e manter sua conta, permitir o acesso seguro, prestar o serviço contratado, responder contatos e chamados, cumprir obrigações legais e melhorar o produto. As bases legais são a execução de contrato, o cumprimento de obrigação legal, o legítimo interesse e, quando necessário, o consentimento.</p>
      <h2>3. Compartilhamento</h2>
      <p>Não vendemos dados. Usamos fornecedores de infraestrutura para hospedar o site e o banco de dados (Vercel e Supabase), que tratam os dados apenas para operar o serviço. Futuras integrações com redes sociais, anúncios e marketplaces só acontecerão com autorização expressa do cliente.</p>
      <h2>4. Isolamento entre clientes</h2>
      <p>Cada conta só enxerga os próprios dados. A separação é aplicada diretamente no banco de dados, e não apenas nas telas.</p>
      <h2>5. Por quanto tempo guardamos</h2>
      <p>Enquanto a conta estiver ativa e pelo prazo necessário para cumprir obrigações legais. Após um pedido de exclusão, os dados são apagados ou anonimizados, salvo o que a lei exigir manter.</p>
      <h2>6. Seus direitos</h2>
      <p>Você pode pedir confirmação e acesso aos dados, correção, anonimização, portabilidade, exclusão, informação sobre compartilhamento e revisão de decisões automatizadas. Dentro do app, use <strong>Minha conta → Privacidade</strong>; fora dele, escreva para <a href={`mailto:${s.contato_email}`}>{s.contato_email}</a>. Respondemos em até 15 dias.</p>
      <h2>7. Segurança</h2>
      <p>Usamos conexão criptografada, controle de acesso por perfil e registro das ações administrativas. Nenhum sistema é infalível; se ocorrer um incidente relevante, os titulares afetados e a ANPD serão comunicados.</p>
      <h2>8. Alterações</h2>
      <p>Esta política pode ser atualizada. A versão vigente fica sempre nesta página, com a data no topo.</p>
    </section>
  );
}
