import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { FileClock, Gauge, Globe, Headphones, Inbox, LayoutGrid, LogOut, Menu, ShieldCheck, Tags, Users, Sparkles } from "lucide-react";
import { EmptyState, Logo } from "../components/ui";
import { useAuth } from "../lib/auth";
import { configured, supabase } from "../lib/supabase";
import { initials, useGuard, useThemeWhileMounted } from "../app/Layout";

const NAV = [
  { to: "/admin", label: "Central", icon: Gauge, end: true },
  { to: "/admin/assinantes", label: "Assinantes", icon: Users, count: "accounts" },
  { to: "/admin/contatos", label: "Contatos do site", icon: Inbox, count: "leads" },
  { to: "/admin/suporte", label: "Suporte", icon: Headphones, count: "tickets" },
  { to: "/admin/planos", label: "Planos", icon: Tags },
  { to: "/admin/site", label: "Conteúdo do site", icon: Globe },
  { to: "/admin/ia", label: "Inteligência artificial", icon: Sparkles },
  { to: "/admin/lgpd", label: "LGPD", icon: ShieldCheck, count: "lgpd" },
  { to: "/admin/auditoria", label: "Auditoria", icon: FileClock },
];

/** contadores do menu: o que está esperando ação da admin */
function useCounts(enabled: boolean, path: string) {
  const [c, setC] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!enabled || !configured) return;
    const head = { count: "exact" as const, head: true };
    Promise.all([
      supabase.from("accounts").select("id", head).eq("status", "trial"),
      supabase.from("contact_leads").select("id", head).eq("status", "novo"),
      supabase.from("support_tickets").select("id", head).eq("status", "aberto"),
      supabase.from("lgpd_requests").select("id", head).in("status", ["aberta", "em_andamento"]),
    ]).then(([a, l, t, g]) => setC({ accounts: a.count ?? 0, leads: l.count ?? 0, tickets: t.count ?? 0, lgpd: g.count ?? 0 }));
  }, [enabled, path]);
  return c;
}

export default function AdminLayout() {
  useThemeWhileMounted();
  const blocked = useGuard();
  const { profile, signOut } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const counts = useCounts(Boolean(profile?.is_super_admin), loc.pathname);
  useEffect(() => setOpen(false), [loc.pathname]);
  if (blocked) return blocked;
  if (!profile?.is_super_admin)
    return <div className="setup"><EmptyState title="Acesso restrito" text="O backoffice é exclusivo da administração do MarketTrace." action={<Link to="/app" className="btn btn-primary">Ir para o app</Link>} /></div>;

  const current = NAV.find((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to)));
  return (
    <div className="shell shell-admin">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link to="/admin" style={{ textDecoration: "none" }}><Logo size={22} light /></Link>
        <span className="admin-tag">Backoffice</span>
        <nav className="side-nav">
          {NAV.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}>
              <i.icon size={17} /> {i.label}
              {i.count && counts[i.count] ? <span className="count">{counts[i.count]}</span> : null}
            </NavLink>
          ))}
          <span className="side-label">Atalhos</span>
          <NavLink to="/app"><LayoutGrid size={17} /> Minha conta de assinante</NavLink>
          <a href="/" target="_blank" rel="noreferrer"><Globe size={17} /> Ver o site</a>
        </nav>
        <div className="side-bottom">
          <div className="user-row">
            <span className="avatar">{initials(profile.nome)}</span>
            <div><strong>{profile.nome}</strong><small>Administradora</small></div>
            <button className="icon-btn" onClick={signOut} title="Sair"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
            <span className="crumb">Backoffice / <strong>{current?.label ?? ""}</strong></span>
          </div>
        </header>
        <div className="content"><Outlet /></div>
      </div>
    </div>
  );
}
