# 🛠️ Como configurar o Radar Regulatório (passo a passo)

Siga na ordem. Só precisa fazer isso UMA vez.

## Parte 1 — Criar o banco no Supabase (~10 min)

1. Entre em <https://supabase.com> e crie um projeto novo
   (ex.: nome `finnet-radar`, região `South America (São Paulo)`).
2. Menu lateral → **SQL Editor** → **New query** → cole o arquivo
   `supabase/schema.sql` INTEIRO → botão **Run**. Isso cria as tabelas
   e as regras de segurança.

   > 🔄 **Banco criado antes de 16/08/2026?** Rode a migração
   > `supabase/migracao-2026-08-16.sql` do mesmo jeito: cole o arquivo
   > INTEIRO no **SQL Editor** e clique em **Run** (pode rodar mais de
   > uma vez sem erro). Quem cria o banco do zero com o `schema.sql`
   > atual **não** precisa — ele já inclui essas mudanças.
3. Menu **Authentication → Sign In / Up**: deixe só **Email** ativado e
   **desligue** a opção de cadastro público ("Allow new users to sign up"),
   para que só você crie os usuários.
4. Menu **Authentication → Users → Add user → Create new user**: crie
   **só o SEU usuário** (e-mail + senha). O primeiro usuário vira
   **administrador automaticamente** — o resto do time você cria depois,
   dentro do próprio sistema, na aba **👥 Usuários**.
5. Menu **Edge Functions → Deploy a new function** (pode ser "via Editor"):
   - Nome da função: `admin-usuarios`
   - Apague o exemplo e cole o conteúdo INTEIRO do arquivo
     `supabase/functions/admin-usuarios/index.ts` → **Deploy**.
   - É ela que permite criar usuários, resetar senhas e desativar acessos
     pela aba Usuários (essas ações usam a chave secreta, que fica no
     Supabase — nunca no site).
6. Menu **Project Settings → API** e deixe a página aberta — você vai
   copiar 3 valores dela:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - chave **anon public** (pública, vai no site)
   - chave **service_role** (SECRETA, só o robô usa)

## Parte 2 — Ligar o site (~2 min)

1. Abra `src/lib/config.js` e preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
2. No terminal, dentro da pasta do projeto:
   ```
   npm install
   npm run dev
   ```
3. Abra o endereço que aparecer (normalmente `http://localhost:5173`) e
   entre com o usuário criado na Parte 1. O feed estará vazio — normal,
   ainda não coletamos nada.

> 💡 Se o `npm install` reclamar de certificado
> (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`), rode antes:
> `$env:NODE_OPTIONS = "--use-system-ca"`

## Parte 3 — Primeira coleta (~2 min)

1. Copie `coletor/config.local.exemplo.js` para `coletor/config.local.js`
   e preencha com a **Project URL** e a chave **service_role**.
   (Esse arquivo fica só no seu PC — o git ignora ele.)
2. Rode:
   ```
   npm run coletar
   ```
3. Recarregue o site: o feed aparece preenchido e os normativos com tema
   Finnet já entram no Radar como **Encontrado**. 🎉

Para testar as fontes sem gravar nada: `npm run coletar:teste`.

## Parte 4 — Robô automático no GitHub (~10 min)

1. Crie um repositório no GitHub (ex.: `finnet-radar`) e envie o projeto:
   ```
   git init
   git add .
   git commit -m "Radar Regulatório Finnet"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/finnet-radar.git
   git push -u origin main
   ```
2. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
   Crie DOIS segredos:
   - `SUPABASE_URL` → a Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` → a chave service_role
3. Aba **Actions** → aceite habilitar os workflows → escolha
   **"Coletor do Radar"** → **Run workflow** para testar na hora.
4. Pronto: ele passa a rodar sozinho **a cada 3 horas**.

## Alertas por e-mail/Teams (opcional, ~10 min)

Quando um normativo novo entra no Radar, o robô pode avisar o time por
e-mail e/ou por mensagem no Teams. Sem os segredos abaixo, ele apenas
escreve "Digest desativado" no log e segue normalmente.

**E-mail (via Resend):**

1. Crie uma conta gratuita em <https://resend.com>.
2. Menu **API Keys → Create API Key** e copie a chave (começa com `re_`).
3. No GitHub (**Settings → Secrets and variables → Actions**), crie:
   - `RESEND_API_KEY` → a chave copiada
   - `DIGEST_PARA` → e-mail(s) de destino, separados por vírgula
     (ex.: `ana@finnet.com.br, joao@finnet.com.br`)

> ⚠️ Sem um domínio próprio verificado no Resend, o plano gratuito só
> entrega para o e-mail da PRÓPRIA conta. Para enviar ao time todo,
> verifique um domínio em **Domains** e ajuste o remetente no
> `coletor/coletar.js` (campo `from`).

**Teams (via webhook):**

1. No canal do Teams: **⋯ → Fluxos de trabalho (Workflows)** →
   escolha **"Postar em um canal quando uma solicitação de webhook
   for recebida"** → conclua e copie a URL gerada.
2. No GitHub, crie o secret `TEAMS_WEBHOOK_URL` com essa URL.

Pode usar só um dos dois, ou os dois. Para testar na hora: aba
**Actions → Coletor do Radar → Run workflow**.

## Parte 5 — Publicar o site (opcional, ~5 min)

```
npm run deploy
```

Depois, no GitHub: **Settings → Pages** → confira que a origem é a branch
`gh-pages`. O site fica em `https://SEU-USUARIO.github.io/finnet-radar/`.

> ⚠️ Com o plano gratuito do GitHub, o Pages exige repositório **público**.
> Tudo bem: os dados e o quadro só aparecem para quem faz login
> (a chave anon é pública por natureza; a segurança está nas regras RLS
> do banco). Ainda assim, NUNCA suba a chave service_role para o código —
> ela vive só nos Secrets.

## Dúvidas comuns

- **"DOU falhou (fetch failed)" rodando no SEU PC** — é o DNS da sua rede,
  que não resolve o `in.gov.br` (já confirmamos isso). No GitHub Actions
  funciona normalmente. Se quiser resolver localmente, troque o DNS do
  Windows para `8.8.8.8` (Google).
- **Uma fonte falhou no log do coletor** — as outras continuam; veja
  `docs/fontes-de-dados.md` (as APIs da Febraban e do Coaf não são
  documentadas e podem mudar).
- **Quero mudar a frequência** — edite o `cron` em
  `.github/workflows/coletor.yml` (ex.: `'0 */6 * * *'` = a cada 6 horas).
- **Quero adicionar palavras-chave/temas** — edite `coletor/temas.js`
  (palavras sem acento).
- **Criar mais usuários** — dentro do sistema: aba **👥 Usuários** (só
  administradores veem). Lá também dá para resetar senha, desativar
  acesso e promover alguém a admin.
- **Ver quem está usando o sistema** — aba **📈 Atividade** (só admins):
  logins, envios ao Radar, mudanças de status e tempo de uso por dia.
- **A aba Usuários diz que não achou a função** — falta publicar a Edge
  Function `admin-usuarios` (passo 5 da Parte 1).
