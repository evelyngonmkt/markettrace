import { lazy, Suspense, useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { EmptyState, Loading } from "./components/ui";
import SiteLayout from "./site/Layout";
import Home from "./site/Home";
import { Contact, Features, Plans, Privacy } from "./site/Pages";
import { ForgotPassword, Login, ResetPassword, Signup } from "./site/Auth";

// Área do cliente e backoffice só carregam quando alguém entra neles
const AppLayout = lazy(() => import("./app/Layout"));
const Overview = lazy(() => import("./app/Overview"));
const Calculators = lazy(() => import("./app/Calculators"));
const Research = lazy(() => import("./app/Research"));
const Social = lazy(() => import("./app/Social"));
const Identity = lazy(() => import("./app/Identity"));
const Work = () => import("./app/Work");
const Companies = lazy(() => Work().then((m) => ({ default: m.Companies })));
const Campaigns = lazy(() => Work().then((m) => ({ default: m.Campaigns })));
const Budgets = lazy(() => Work().then((m) => ({ default: m.Budgets })));
const Sales = lazy(() => Work().then((m) => ({ default: m.Sales })));
const Content = () => import("./app/Content");
const Agenda = lazy(() => Content().then((m) => ({ default: m.Agenda })));
const Tasks = lazy(() => Content().then((m) => ({ default: m.Tasks })));
const Studio = lazy(() => Content().then((m) => ({ default: m.Studio })));
const AccountPages = () => import("./app/Account");
const Integrations = lazy(() => AccountPages().then((m) => ({ default: m.Integrations })));
const Team = lazy(() => AccountPages().then((m) => ({ default: m.Team })));
const Support = lazy(() => AccountPages().then((m) => ({ default: m.Support })));
const MyAccount = lazy(() => AccountPages().then((m) => ({ default: m.MyAccount })));
const AdminLayout = lazy(() => import("./admin/Layout"));
const AdminPages = () => import("./admin/Pages");
const AdminHome = lazy(() => AdminPages().then((m) => ({ default: m.AdminHome })));
const AdminAccounts = lazy(() => AdminPages().then((m) => ({ default: m.AdminAccounts })));
const AdminLeads = lazy(() => AdminPages().then((m) => ({ default: m.AdminLeads })));
const AdminTickets = lazy(() => AdminPages().then((m) => ({ default: m.AdminTickets })));
const AdminPlans = lazy(() => AdminPages().then((m) => ({ default: m.AdminPlans })));
const AdminSite = lazy(() => AdminPages().then((m) => ({ default: m.AdminSite })));
const AdminLgpd = lazy(() => AdminPages().then((m) => ({ default: m.AdminLgpd })));
const AdminAudit = lazy(() => AdminPages().then((m) => ({ default: m.AdminAudit })));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <section className="section">
      <EmptyState title="Página não encontrada" text="O endereço pode ter mudado ou não existe mais." action={<Link to="/" className="btn btn-primary">Voltar ao início</Link>} />
    </section>
  );
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="funcionalidades" element={<Features />} />
            <Route path="planos" element={<Plans />} />
            <Route path="contato" element={<Contact />} />
            <Route path="privacidade" element={<Privacy />} />
            <Route path="entrar" element={<Login />} />
            <Route path="cadastro" element={<Signup />} />
            <Route path="recuperar-senha" element={<ForgotPassword />} />
            <Route path="nova-senha" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="app" element={<AppLayout />}>
            <Route index element={<Overview />} />
            <Route path="empresas" element={<Companies />} />
            <Route path="identidade" element={<Identity />} />
            <Route path="campanhas" element={<Campaigns />} />
            <Route path="calculadoras" element={<Calculators />} />
            <Route path="social" element={<Social />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="tarefas" element={<Tasks />} />
            <Route path="orcamentos" element={<Budgets />} />
            <Route path="canais-de-venda" element={<Sales />} />
            <Route path="estudio" element={<Studio />} />
            <Route path="pesquisa" element={<Research />} />
            <Route path="integracoes" element={<Integrations />} />
            <Route path="equipe" element={<Team />} />
            <Route path="suporte" element={<Support />} />
            <Route path="conta" element={<MyAccount />} />
          </Route>

          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminHome />} />
            <Route path="assinantes" element={<AdminAccounts />} />
            <Route path="contatos" element={<AdminLeads />} />
            <Route path="suporte" element={<AdminTickets />} />
            <Route path="planos" element={<AdminPlans />} />
            <Route path="site" element={<AdminSite />} />
            <Route path="lgpd" element={<AdminLgpd />} />
            <Route path="auditoria" element={<AdminAudit />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
