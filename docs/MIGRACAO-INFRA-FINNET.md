# Migração para a infraestrutura da Finnet

> Guia para o time de infra/segurança migrar o **Radar Regulatório** da stack
> atual (GitHub pessoal + GitHub Pages + GitHub Actions + Supabase) para a
> infraestrutura oficial da Finnet, mantendo o sistema no ar durante todo o
> processo.
>
> Leia junto com `docs/documentacao-tecnica.html` (arquitetura e código),
> `docs/COMO-CONFIGURAR.md` (como a stack atual foi montada) e
> `docs/fontes-de-dados.md` (URLs externas que o robô acessa).
> Última atualização: 2026-08-20.

## De → Para

| Peça | Hoje | Destino |
|---|---|---|
| Código-fonte | GitHub pessoal `henriqueizzo` (repositório **público**) | Git da Finnet (repositório **privado**) |
| Site (frontend) | GitHub Pages (branch `gh-pages`) | Hospedagem estática da Finnet (nginx/IIS/S3 — qualquer uma serve) |
| Banco + login + Edge Function | Supabase em conta pessoal | Supabase em **organização da Finnet** (transferência de projeto) — ver §3 |
| Robô coletor (3/3h) | GitHub Actions (`.github/workflows/coletor.yml`) | Scheduler da Finnet (Actions da org, pipeline agendada ou cron em servidor) |
| Alertas e-mail/Teams | Resend (conta pessoal) + webhook do Teams | Conta Resend corporativa (ou SMTP da casa) + mesmo webhook |

**Por que migrar:** hoje tudo roda em contas pessoais (risco de continuidade),
o repositório é público por exigência do GitHub Pages gratuito, e as chaves
ficam fora da custódia da empresa.

---

## 1. Contrato de runtime (o que a aplicação precisa)

O sistema tem **duas peças independentes** — nenhuma exige servidor de aplicação:

### a) Site — arquivos estáticos puros

- Build: **Node 20** → `npm ci && npm run build` → sai a pasta `dist/`.
- O `vite.config.js` usa `base: './'`, então o site funciona em **qualquer
  endereço/subpasta** sem ajuste.
- Servir `dist/` em **HTTPS** (o login do Supabase roda no navegador).
  Nenhum processo, porta ou variável de ambiente no servidor web.
- A URL e a chave **anon** do Supabase ficam em `src/lib/config.js` —
  são públicas por design (a segurança está nas regras RLS do banco).

### b) Robô coletor — processo Node agendado

- **Node 20**, comando: `node coletor/coletar.js` (roda e termina, ~1–3 min).
- Frequência atual: **a cada 3 horas** (cron `17 */3 * * *`, horário UTC).
- Variáveis de ambiente:

| Variável | Obrigatória | O que é |
|---|---|---|
| `SUPABASE_URL` | ✅ | Project URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | chave **secreta** service_role (só o robô usa; NUNCA vai para o site nem para o repositório) |
| `RESEND_API_KEY` | opcional | e-mail de alerta (sem ela o digest é só pulado) |
| `DIGEST_PARA` | opcional | destinatários, separados por vírgula |
| `TEAMS_WEBHOOK_URL` | opcional | alerta no canal do Teams |

- **Saída de rede (firewall/proxy):** o robô acessa por HTTPS o Banco Central
  (`bcb.gov.br`), Coaf, Febraban, Open Finance Brasil, DOU (`in.gov.br`),
  o Supabase (`*.supabase.co`) e, se ativos, `api.resend.com` e o webhook do
  Teams. As URLs exatas estão em `docs/fontes-de-dados.md`. Se o robô rodar
  dentro da rede Finnet, essas saídas precisam estar liberadas.

---

## 2. Código-fonte (Git)

Migrar **pelo Git, com histórico completo** — não por zip:

```bash
git clone --mirror https://github.com/henriqueizzo/finnet-radar.git
cd finnet-radar.git
git push --mirror https://git-da-finnet/<projeto>/finnet-radar.git
```

- O repositório de destino deve ser **privado**.
- Depois da troca, o GitHub pessoal pode ficar ~2 semanas como espelho de
  segurança e então ser arquivado.
- ⚠️ O workflow `.github/workflows/coletor.yml` só funciona em GitHub. Se o
  destino for Bitbucket/GitLab/Azure DevOps, recriar o agendamento no
  equivalente (pipeline agendada) ou num servidor com cron — o job é só
  "Node 20 + `npm ci` + `node coletor/coletar.js` + as env vars do §1b".

## 3. Banco, login e Edge Function (Supabase)

O caminho **mais simples e sem downtime** é transferir o projeto inteiro:

1. Criar uma **organização Finnet** no Supabase (com e-mail corporativo,
   billing da empresa).
2. No projeto atual: **Settings → General → Transfer project** → escolher a
   organização Finnet.
3. Pronto: dados, usuários, chaves, regras RLS e a Edge Function
   `admin-usuarios` **continuam idênticos** — site e robô nem percebem
   (URL e chaves não mudam). Zero janela de parada.

Alternativa, se a política da Finnet exigir projeto novo (ou sair do Supabase):

- Projeto novo: rodar `supabase/schema.sql` no SQL Editor → copiar os dados
  (`pg_dump`/`pg_restore` das tabelas do schema `public`) → recriar os
  usuários em Authentication (senhas não são exportáveis — cada um define a
  sua no primeiro acesso) → publicar de novo a Edge Function
  (`supabase/functions/admin-usuarios/index.ts`) → atualizar URL/chaves em
  `src/lib/config.js` e nos secrets do robô → republicar o site.
- Sair do Supabase (Postgres próprio) é um projeto maior: além do banco,
  seria preciso substituir o login (Supabase Auth) e a Edge Function.
  **Não recomendado** como primeiro passo — transferir o projeto resolve a
  questão da custódia agora, e essa decisão pode ser tomada com calma depois.

## 4. Site (hospedagem estática)

1. Build numa máquina/pipeline com Node 20: `npm ci && npm run build`.
2. Publicar o conteúdo de `dist/` no servidor escolhido, com HTTPS.
3. Definir a URL oficial (ex.: `radar.finnet.com.br` ou endereço interno).
4. No Supabase (**Authentication → URL Configuration**), atualizar a
   **Site URL** para a URL nova.
5. Desativar o GitHub Pages antigo **só depois** de validar o novo endereço.

O site pode ser interno (VPN) ou público — como o acesso exige login e os
dados são protegidos por RLS, as duas opções são seguras. Decisão da Finnet.

## 5. Segredos — inventário e rotação

| Segredo | Onde está hoje | Ação na migração |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Secrets do GitHub pessoal + `coletor/config.local.js` (PC local) | Mover para o cofre/secrets da Finnet e **rotacionar** (Settings → API → gerar nova) após a troca |
| Chave anon | `src/lib/config.js` (pública) | Nada — é pública por design |
| `RESEND_API_KEY` | Secrets do GitHub | Criar conta Resend corporativa (ou trocar por SMTP da casa) e gerar chave nova |
| `TEAMS_WEBHOOK_URL` | Secrets do GitHub | Regerar o fluxo no canal oficial do time |
| Senhas dos usuários | Supabase Auth (hash) | Migram junto na transferência do projeto (§3) |

Regra de ouro: segredo **nunca** vai dentro do repositório — sempre pelo
cofre de segredos / secrets do CI da Finnet.

## 6. Checklist de migração (ordem sugerida)

1. ☐ Backup feito (zip com `.git` + bundle) — guardado fora da máquina.
2. ☐ Criar organização Finnet no Supabase e **transferir o projeto** (§3).
3. ☐ Espelhar o repositório no Git da Finnet (§2); repositório privado.
4. ☐ Recriar o agendamento do coletor no scheduler da Finnet com os secrets
   no cofre (§1b, §5); rodar uma coleta manual e conferir o feed.
5. ☐ Build + publicar o site na hospedagem da Finnet (§4); validar login,
   feed, radar (kanban) e a aba Usuários (Edge Function).
6. ☐ Atualizar a Site URL no Supabase Auth.
7. ☐ **Rollback disponível**: manter GitHub Pages + Actions antigos
   desativados-mas-intactos por ~2 semanas; qualquer problema, religa.
8. ☐ Rotacionar `SUPABASE_SERVICE_ROLE_KEY`, Resend e webhook do Teams (§5).
9. ☐ Arquivar o repositório pessoal e apagar `coletor/config.local.js` das
   máquinas pessoais.
10. ☐ Atualizar `docs/COMO-CONFIGURAR.md` e a documentação técnica com os
    endereços novos.

## 7. Perguntas em aberto para o time de infra

1. **Git da casa**: GitHub (org), Bitbucket, GitLab ou Azure DevOps? Define
   como o agendamento do robô será recriado (§2).
2. **Hospedagem do site**: servidor interno, S3/CloudFront, outro? Público ou
   atrás de VPN? Qual domínio?
3. **Supabase**: a política de segurança aceita SaaS (dados ficam no Supabase,
   região São Paulo)? Se sim, quem administra a organização? Se não, planejar
   a saída (§3, alternativa) como fase 2.
4. **Robô**: rodar no CI (pipeline agendada) ou num servidor da casa? Nesse
   caso, liberar as saídas de rede do §1b.
5. **Alertas**: manter Resend, trocar pelo SMTP corporativo, ou só Teams?
6. **Custódia dos segredos**: qual cofre é o padrão (e quem acessa)?
