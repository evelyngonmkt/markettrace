# MarketTrace — Do dado à decisão.

Plataforma para profissionais, times e diretorias de marketing.
Produto idealizado por **Evelyn Gonçalves**.

O projeto tem três partes no mesmo site:

| Parte | Endereço | Quem acessa |
|---|---|---|
| 1. Site institucional | `/`, `/funcionalidades`, `/planos`, `/contato`, `/privacidade` | Qualquer pessoa |
| 2. Área do cliente | `/app` | Assinantes e suas equipes (login) |
| 3. Backoffice | `/admin` | Somente a administração (e-mails em `platform_admins`) |

Tecnologia: React + Vite (site), Supabase (banco de dados e login) e Vercel (hospedagem).

---

## Como publicar (passo a passo, sem terminal)

### 1. Banco de dados — Supabase
1. Entre em supabase.com com **evelyngon.mkt@gmail.com** e clique em **New project**. Nome: `markettrace`. Região: **South America (São Paulo)**. Anote a senha do banco num lugar seguro.
2. No menu lateral, abra **SQL Editor → New query**.
3. Abra o arquivo `supabase/migrations/0001_markettrace.sql`, copie **todo** o conteúdo, cole no editor e clique em **Run**. Deve aparecer *Success*.
4. Abra **Authentication → URL Configuration**:
   - **Site URL:** o endereço do site na Vercel (ex.: `https://markettrace.vercel.app`). Dá para voltar e ajustar depois do passo 3.
   - **Redirect URLs:** adicione `https://SEU-SITE.vercel.app/**`.
5. Abra **Project Settings → API** e copie a **Project URL** e a chave **anon public**. Elas vão para a Vercel.

> A chave `service_role` **nunca** deve ir para o site nem para o GitHub.

### 2. Código — GitHub
1. Em github.com, clique em **New repository**, dê o nome `markettrace` e deixe **Private**. Não marque README.
2. Na página do repositório vazio, clique em **uploading an existing file**.
3. Arraste **o conteúdo** da pasta `markettrace` (as pastas `src`, `public` e `supabase` e os arquivos soltos) e clique em **Commit changes**. São menos de 50 arquivos, dentro do limite do GitHub.

### 3. Site — Vercel
1. Em vercel.com, clique em **Add New → Project** e importe o repositório `markettrace`.
2. A Vercel reconhece **Vite** sozinha. Antes de clicar em Deploy, abra **Environment Variables** e cadastre:
   - `VITE_SUPABASE_URL` = a Project URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` = a chave anon public
3. Clique em **Deploy**. Quando terminar, copie o endereço do site e confira se ele está no passo 1.4 do Supabase.

### 4. Primeiro acesso
1. Abra o site, clique em **Começar agora** e crie a conta com **evelyngon.mkt@gmail.com**.
2. Confirme o e-mail pelo link que o Supabase enviar.
3. Pronto: essa conta já nasce como **administradora**, com a empresa **MCI Store** cadastrada.
   - Área do cliente: `/app`
   - Backoffice: `/admin` (também aparece no menu lateral do app)
4. No backoffice, em **Planos**, crie os planos e preços. Eles aparecem automaticamente no site.
5. Em **Conteúdo do site**, revise seus contatos e adicione o portfólio.

---

## Regras de segurança já aplicadas
- Toda tabela tem RLS (Row Level Security): cada conta só enxerga os próprios dados. Foi testado com contas diferentes.
- Ninguém consegue se promover a admin ou ativar a própria conta pelo app. Isso só é possível pelo backoffice.
- Leitores (papel "leitor") só consultam; editores criam e alteram; o dono gerencia a equipe.
- Visitantes só podem **enviar** o formulário de contato, e não ler o que outras pessoas mandaram.
- Contas, planos, chamados, contatos e conteúdo do site ficam registrados na **Auditoria**.

## Para adicionar outra administradora no futuro
No backoffice: **Assinantes → Pessoas → Tornar admin** (a pessoa precisa ter se cadastrado antes).

## O que ainda não existe (próximas etapas)
- Pagamento online (hoje a conta nasce em teste grátis de 14 dias e a ativação é feita no backoffice).
- Integrações reais com redes sociais, anúncios, marketplaces e Google Agenda (as telas mostram "em breve" e registram o interesse dos clientes).
- Aviso por e-mail quando chega contato ou chamado (hoje aparecem com contador no menu do backoffice).

## Rodar no computador (opcional, para desenvolvedores)
```bash
npm install
cp .env.example .env.local   # preencha as duas chaves
npm run dev
```
