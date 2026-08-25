# Fontes de dados do Radar Regulatório FINNET

> Mapa de fontes verificado em 15/08/2026 — todas as URLs abaixo foram testadas com requisições HTTP reais.
> Nenhuma fonte principal exige chave de API ou pagamento.

## Tabela-resumo

| Fonte | Melhor método | Formato | Dificuldade |
|---|---|---|---|
| BCB — Normativos | Feed Atom oficial | Atom/XML | Fácil |
| BCB — Comunicados | Feed Atom oficial | Atom/XML | Fácil |
| BCB — Notícias | Feed Atom oficial | Atom/XML | Fácil |
| BCB — Busca/texto integral | API JSON | JSON | Fácil |
| Coaf — Notícias | API Plone REST (não documentada) | JSON | Médio |
| Coaf — Resoluções | Via DOU | JSON | Médio |
| Febraban — Notícias | Endpoint AJAX interno | JSON | Fácil/Médio |
| Open Finance — Wiki | Confluence REST anônima | JSON | Fácil |
| Open Finance — Specs | GitHub releases.atom | Atom | Fácil |
| Open Finance — Site institucional | BLOQUEADO (WAF 403) | — | Difícil (não usar) |
| DOU | JSON embutido no leiturajornal | JSON dentro de HTML | Médio |

## 1. Banco Central do Brasil (BCB) — melhor fonte de todas

O site é uma SPA Angular, mas todo o conteúdo vem de APIs públicas em `www.bcb.gov.br/api/...`, sem autenticação.

### Feeds Atom (atualizados no mesmo dia da publicação, dias úteis)
- **Normativos** (Resoluções BCB, Resoluções CMN, Instruções Normativas):
  `https://www.bcb.gov.br/api/feed/app/normativos/normativos?ano=2026`
  (título, data, ementa completa e link)
- **Atos e Comunicados**:
  `https://www.bcb.gov.br/api/feed/app/demaisnormativos/atosecomunicados?ano=2026`
- **Notícias**: `https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/noticias`
- **Notas à imprensa**: `https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/notasImprensa?ano=2026`
- Lista completa de ~30 feeds (Copom, Focus, Diário Eletrônico, Blog do BC...):
  `https://www.bcb.gov.br/api/paginasite/sitebcb/acessoinformacao/rss`

### API JSON de busca de normas
- **Busca**:
  `https://www.bcb.gov.br/api/search/app/normativos/buscanormativos?querytext=ContentType:normativo%20AND%20contentSource:normativos&rowlimit=10&startrow=0&sortlist=Data1OWSDATE:descending`
  Campos: `title`, `data` (ISO), `TipodoNormativoOWSCHCS`, `NumeroOWSNMBR`, `AssuntoNormativoOWSMTXT` (ementa), `RevogadoOWSBOOL`.
  - Filtro por tipo: acrescentar ao querytext `%20AND%20TipodoNormativoOWSCHCS:%22Resolu%C3%A7%C3%A3o%20BCB%22`
  - Filtro por data: `&refinementfilters=Data:range(datetime(2026-01-01),datetime(2026-12-31))`
- **Texto completo de um normativo**:
  `https://www.bcb.gov.br/api/conteudo/app/normativos/exibenormativo?p1=RESOLU%C3%87%C3%83O%20BCB&p2=496`
  Retorna `Titulo`, `Data`, `DOU`, `Assunto`, `Texto` (HTML integral), `NormasVinculadas`, `Revogado`.
  ⚠️ O `p1` exige acentos ("RESOLUÇÃO BCB" URL-encoded); sem acento retorna vazio.
  Para Comunicados, usar `exibeoutrasnormas` no lugar de `exibenormativo`.
- Dados Abertos (`dadosabertos.bcb.gov.br`): NÃO tem normativos (só dados econômicos). Não usar para este projeto.

## 2. Coaf (gov.br/coaf)

Portal novo em Plone 6 + Volto. RSS antigo está morto; páginas HTML dão 401 para bots. Porém a **API REST do Plone funciona anonimamente** (na raiz do site):

```
https://www.gov.br/coaf/++api++/@search?portal_type=News+Item&sort_on=effective&sort_order=descending&b_size=10
```
Retorna `@id` (URL), `title`, `description`, `effective` (data ISO). ~250 News Items no total.
- Paginação: `b_start` · Filtro por caminho: `&path=/coaf/pt-br/assuntos/noticias` · Busca: `&SearchableText=...`
- ⚠️ Só funciona o `@search` NA RAIZ (em subpastas dá Unauthorized). Enviar `Accept: application/json` + **User-Agent de navegador**.
- Resoluções Coaf não têm feed próprio → capturar via DOU (Seção 1).
- API não documentada; pode mudar com a evolução do portal — monitorar falhas.

## 3. Febraban

Sem RSS. Endpoint JSON interno que alimenta a página de notícias (verificado):

```
GET https://portal.febraban.org.br/Noticias/GetItems?page=1&selectedData=&selectedText=
```
Retorna `{"Items":[...]}` com `IdTexto`, `Descricaop` (título), `Resumop`, `Publicar` (data ASP.NET `\/Date(epoch_ms)\/`), `Hora`, `Imagem`.
- URL da matéria: `https://portal.febraban.org.br/noticia/{IdTexto}/pt-br/`
- Imagens: `https://noticiasimg.febraban.org.br/imagens/crop/{arquivo}`
- ⚠️ Endpoint interno não documentado — pode mudar sem aviso. Parse da data: extrair epoch de `\/Date(...)\/`.

## 4. Open Finance Brasil

### Wiki Confluence (REST anônima funciona)
- Espaços: `https://openfinancebrasil.atlassian.net/wiki/rest/api/space?limit=25` → `OF` ("Área do Desenvolvedor"), `DraftOF` ("Draft"), `GDEDU`...
- **Páginas alteradas recentemente (melhor para monitoramento)**:
  `https://openfinancebrasil.atlassian.net/wiki/rest/api/content/search?cql=space=DraftOF%20order%20by%20lastmodified%20desc&limit=10&expand=version`
  Retorna título + `version.when`. Para conteúdo: `expand=body.storage,version`. Trocar `DraftOF` por `OF` para a área oficial.

### GitHub (especificações)
- Repos por atualização: `https://api.github.com/orgs/OpenBanking-Brasil/repos?sort=updated&per_page=10` (limite 60 req/h sem token)
- Releases por repo (Atom, sem limite): `https://github.com/OpenBanking-Brasil/openapi/releases.atom` (também `commits/main.atom` e `tags.atom`)

### Site institucional openfinancebrasil.org.br — BLOQUEADO
WordPress atrás de CloudFront/WAF: `/feed/`, `/wp-json/...` e páginas retornam 403 para qualquer cliente automatizado. Não usar.

## 5. DOU (Diário Oficial da União)

### JSON embutido do leiturajornal (sem cadastro)
```
https://www.in.gov.br/leiturajornal?data=14-08-2026&secao=do1
```
O HTML contém `"jsonArray":[...]` com todas as publicações do dia (~430 itens/edição).
Campos: `pubName`, `urlTitle`, `title`, `pubDate`, `content`, `artType`, `hierarchyList` (**filtrar aqui**: "Banco Central do Brasil"; "Ministério da Fazenda" + "Conselho de Controle de Atividades Financeiras" para o Coaf).
- Texto completo: `https://www.in.gov.br/web/dou/-/{urlTitle}`
- É preciso extrair o JSON do HTML (parser com contagem de chaves).
- ⚠️ DNS: `www.in.gov.br` pode falhar com DNS local; usar DNS público (8.8.8.8).

### Alternativas
- **INLabs** (oficial, XML em massa, cadastro grátis): `https://www.gov.br/imprensanacional/pt-br/servicos/inlabs` · scripts: `https://github.com/Imprensa-Nacional/inlabs` (domínio `inlabs.in.gov.br` instável).
- **Ro-DOU** (`https://github.com/gestaogovbr/Ro-dou`): monitor open-source do governo (Airflow) — referência de ideias.
- Querido Diário NÃO serve (só diários municipais).

## Estratégia de coleta recomendada

- BCB (feeds Atom) e Coaf: a cada poucas horas.
- DOU: 1x/dia de manhã (edição sai de madrugada), filtrando `hierarchyList`.
- Confluence Open Finance (CQL lastmodified) + GitHub releases.atom: 1x/dia.
- Febraban: 1x/dia.
- Usar User-Agent de navegador nas fontes gov.br e Febraban.

## Temas FINNET para filtro por palavras-chave

Perfil regulatório da empresa (IP autorizada modalidade ITP desde 2023; homologada Open Finance/Pix dez/2024):

| Tema | Palavras-chave sugeridas |
|---|---|
| Instituições de Pagamento | instituição de pagamento, arranjo de pagamento, Res. BCB 80/81 |
| Pix / ITP | Pix, iniciação de pagamento, iniciador, Bolepix |
| Open Finance | open finance, open banking, consentimento, ITP |
| PLD/FT | lavagem de dinheiro, PLD, FT, Coaf, Siscoaf, Circular 3.978 |
| Duplicata escritural | duplicata escritural, registradora, Res. BCB 540 |
| Cobrança/boleto | boleto, cobrança, CIP, Núclea, DDA |
| LGPD | LGPD, dados pessoais, ANPD |
| Cibersegurança | segurança cibernética, incidente, Res. BCB 85 |

---

## Canais fechados do Banco Central (registro manual — aba 📮 Comunicações)

Estes canais **exigem login da instituição** no site do BC — não têm API pública,
então o robô NÃO consegue coletá-los. O que chega por eles deve ser registrado
à mão na aba **📮 Comunicações**, que classifica o evento, cobra prazo,
sugere plano de ação e destaca o que está sem resposta:

| Canal | O que chega por ele |
| --- | --- |
| **BC Correio** | comunicações oficiais da supervisão, demandas, notificações |
| **Protocolo Digital** | protocolos de documentos e solicitações formais |
| **UNICAD** | atualizações e exigências cadastrais |
| **Siscom/Siscon** | comunicações operacionais (conforme nomenclatura vigente) |
| **CRD** | demandas de registro/dados |
| **Cartas e ofícios** | correspondências físicas/digitais do BC |
| **Governança Open Finance** | comunicados das estruturas, atas e decisões dos GTs |

Tipos de evento usados na classificação: Informação · Solicitação · Exigência ·
Fiscalização · Supervisão · Prazo regulatório · Processo administrativo ·
Consulta pública.

## Consultas públicas do BCB (automático, parcial)

Não há API pública dedicada (a página é um app Angular; os endpoints
`/api/servico/sitebcb/consultaspublicas` e variações retornam 400 — testado em
24/08/2026). O coletor cobre o caminho que existe: quando um **Edital de
Consulta Pública / Audiência Pública** sai no feed Atom de atos e comunicados
do BCB, ele entra no feed com a categoria **Consulta Pública** (prioridade 02).

## Repositório de Informes do Open Finance (automático)

- Página do wiki: `https://openfinancebrasil.atlassian.net/wiki/rest/api/content/17367115?expand=body.view` (Confluence REST, sem login)
- Tabela com 3 colunas: **Link** (eepurl.com → arquivo do boletim no Mailchimp),
  **Descrição** (tópicos em `<li>`) e **Data de envio** (`<time datetime>`)
- O título oficial ("[Open Finance] Informa #938") vem do `<title>` da página
  do boletim (seguindo o link eepurl)
- O coletor pega os 8 mais recentes por rodada; a URL única evita duplicar
