// =====================================================================
// MarketTrace · Notificações (Edge Function do Supabase, nome: notificar)
// Chamada pelo próprio banco (agendamentos e gatilhos, com token privado)
// ou pelo app, para a pessoa mandar uma notificação de teste para si.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function chaveProjeto(antiga: string, nova: string) {
  const v = Deno.env.get(antiga);
  if (v) return v;
  try { const o = JSON.parse(Deno.env.get(nova) ?? "{}"); return (o.default ?? Object.values(o)[0]) as string; } catch { return Deno.env.get(nova) ?? ""; }
}

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
type Aviso = { title: string; body: string; url: string; tag?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, chaveProjeto("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS"));
    const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!pub || !priv) return json({ erro: "As chaves de notificação ainda não foram cadastradas no servidor." }, 503);
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:evelyngoncalves.marketing@gmail.com", pub, priv);

    const body = await req.json().catch(() => ({}));

    // envia para todos os aparelhos de uma lista de pessoas; apaga assinaturas vencidas
    const enviar = async (userIds: string[], aviso: Aviso) => {
      if (!userIds.length) return 0;
      const { data: subs } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
      let n = 0;
      for (const s of (subs ?? []) as Sub[]) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), { TTL: 3600 });
          n++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
      return n;
    };
    // marca como enviado; devolve só quem ainda não recebeu
    const naoEnviados = async (userIds: string[], tipo: string, ref: string) => {
      const novos: string[] = [];
      for (const u of userIds) {
        const { error } = await db.from("notification_log").insert({ user_id: u, tipo, ref });
        if (!error) novos.push(u);
      }
      return novos;
    };
    // pessoas com acesso à empresa e com aquela notificação ligada (sem preferência salva = ligada)
    const destinatarios = async (companyId: string, campo: "hora_publicar" | "tarefas_hoje") => {
      const { data: emp } = await db.from("companies").select("account_id").eq("id", companyId).single();
      if (!emp) return [];
      const { data: membros } = await db.from("account_members").select("user_id, papel, empresas").eq("account_id", emp.account_id);
      const comAcesso = (membros ?? []).filter((m) => m.papel === "owner" || !m.empresas || (m.empresas as string[]).includes(companyId)).map((m) => m.user_id as string);
      if (!comAcesso.length) return [];
      const { data: prefs } = await db.from("notification_prefs").select(`user_id, ${campo}`).eq("company_id", companyId).in("user_id", comAcesso);
      const desligou = new Set((prefs ?? []).filter((p) => (p as Record<string, unknown>)[campo] === false).map((p) => p.user_id as string));
      return comAcesso.filter((u) => !desligou.has(u));
    };

    // ---------- teste pelo app ----------
    if (body.teste) {
      const usuario = createClient(url, chaveProjeto("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS"), { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
      const { data: u } = await usuario.auth.getUser();
      if (!u?.user) return json({ erro: "Entre na sua conta." }, 401);
      const n = await enviar([u.user.id], { title: "MarketTrace", body: "Notificações ligadas. Você vai receber os avisos das suas empresas aqui.", url: "/app", tag: "teste" });
      return json({ enviados: n });
    }

    // ---------- chamadas do próprio banco ----------
    const { data: cfg } = await db.from("push_settings").select("token").eq("id", 1).single();
    if (!cfg || req.headers.get("x-markettrace-token") !== cfg.token) return json({ erro: "Não autorizado." }, 401);

    let total = 0;
    if (body.tipo === "hora_publicar") {
      const agora = Date.now();
      const { data: posts } = await db.from("posts").select("id, company_id, titulo, rede, data_hora, companies(nome)")
        .eq("status", "agendado").gte("data_hora", new Date(agora - 6 * 60000).toISOString()).lte("data_hora", new Date(agora + 60000).toISOString());
      for (const p of posts ?? []) {
        const para = await naoEnviados(await destinatarios(p.company_id, "hora_publicar"), "hora_publicar", p.id);
        const empresa = (p.companies as { nome?: string } | null)?.nome ?? "";
        total += await enviar(para, { title: `Hora de publicar · ${empresa}`, body: `${p.titulo} (${p.rede})`, url: `/app/social?post=${p.id}`, tag: `post-${p.id}` });
      }
    } else if (body.tipo === "tarefas_hoje") {
      const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10); // dia em Brasília
      const { data: tarefas } = await db.from("tasks").select("company_id, companies(nome)").eq("prazo", hoje).neq("status", "concluido");
      const porEmpresa = new Map<string, { nome: string; n: number }>();
      for (const t of tarefas ?? []) {
        const cur = porEmpresa.get(t.company_id) ?? { nome: (t.companies as { nome?: string } | null)?.nome ?? "", n: 0 };
        cur.n++; porEmpresa.set(t.company_id, cur);
      }
      for (const [cid, info] of porEmpresa) {
        const para = await naoEnviados(await destinatarios(cid, "tarefas_hoje"), "tarefas_hoje", `${cid}:${hoje}`);
        total += await enviar(para, { title: `Tarefas de hoje · ${info.nome}`, body: info.n === 1 ? "1 tarefa vence hoje." : `${info.n} tarefas vencem hoje.`, url: "/app/tarefas", tag: `tarefas-${cid}` });
      }
    } else if (body.tipo === "suporte" && body.ref) {
      const { data: msg } = await db.from("ticket_messages").select("id, ticket_id, support_tickets(assunto, aberto_por)").eq("id", body.ref).single();
      const t = msg?.support_tickets as { assunto?: string; aberto_por?: string } | null;
      if (t?.aberto_por) {
        const para = await naoEnviados([t.aberto_por], "suporte", String(body.ref));
        total += await enviar(para, { title: "Resposta do suporte", body: t.assunto ?? "Seu chamado foi respondido.", url: "/app/suporte", tag: `ticket-${msg!.ticket_id}` });
      }
    }
    return json({ enviados: total });
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
