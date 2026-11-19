import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Instagram, Linkedin, Mail, Menu, MessageCircle, X } from "lucide-react";
import { Logo } from "../components/ui";
import { useAuth } from "../lib/auth";
import { instagramUrl, useSiteSettings } from "../lib/site";

export default function SiteLayout() {
  const s = useSiteSettings();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="site">
      <header className="site-header">
        <Link to="/" className="site-brand" onClick={close} aria-label="MarketTrace — início"><Logo size={24} /></Link>
        <nav className={`site-nav ${open ? "open" : ""}`}>
          <NavLink to="/funcionalidades" onClick={close}>Funcionalidades</NavLink>
          <NavLink to="/planos" onClick={close}>Planos</NavLink>
          <NavLink to="/contato" onClick={close}>Contato</NavLink>
          {session ? (
            <Link to="/app" className="btn btn-primary btn-sm" onClick={close}>Abrir o app</Link>
          ) : (
            <>
              <Link to="/entrar" className="site-login" onClick={close}>Entrar</Link>
              <Link to="/cadastro" className="btn btn-primary btn-sm" onClick={close}>Começar agora</Link>
            </>
          )}
        </nav>
        <button className="icon-btn site-burger" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </header>

      <main><Outlet /></main>

      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <Logo size={22} light />
            <p className="footer-tag">Do dado à decisão.</p>
            <p className="footer-credit">Produto idealizado por <strong>{s.contato_nome}</strong></p>
          </div>
          <div>
            <span className="data-label">Produto</span>
            <Link to="/funcionalidades">Funcionalidades</Link>
            <Link to="/planos">Planos</Link>
            <Link to="/entrar">Entrar</Link>
            <Link to="/privacidade">Política de privacidade</Link>
          </div>
          <div>
            <span className="data-label">Contato</span>
            <a href={`mailto:${s.contato_email}`}><Mail size={15} /> {s.contato_email}</a>
            {s.contato_whatsapp_link && <a href={s.contato_whatsapp_link} target="_blank" rel="noreferrer"><MessageCircle size={15} /> {s.contato_whatsapp}</a>}
            {s.contato_instagram && <a href={instagramUrl(s.contato_instagram)} target="_blank" rel="noreferrer"><Instagram size={15} /> {s.contato_instagram}</a>}
            {s.contato_linkedin && <a href={s.contato_linkedin} target="_blank" rel="noreferrer"><Linkedin size={15} /> LinkedIn</a>}
          </div>
        </div>
        <p className="footer-legal">© {new Date().getFullYear()} MarketTrace · {s.contato_nome}</p>
      </footer>
    </div>
  );
}
