// Open Finance Brasil — três frentes:
// 1) o wiki público (Confluence) aceita a API REST sem login: pegamos as
//    páginas alteradas mais recentemente em cada espaço;
// 2) os releases das especificações no GitHub (feed Atom, sem limite de uso);
// 3) o "Repositório de Informes" do wiki: uma tabela com cada boletim
//    "Informa" enviado por e-mail aos participantes (link, tópicos e data
//    de envio) — eles entram no feed como "Comunicado".
// O site institucional openfinancebrasil.org.br é bloqueado por firewall — não usamos.
import { buscarJson, buscarTexto, buscarAtom, linkDoAtom, textoDoAtom, limparHtml, resumir } from './util.js'

const WIKI = 'https://openfinancebrasil.atlassian.net/wiki'

// Página "Repositório de Informes" (espaço OF) — a tabela dos boletins
const PAGINA_REPOSITORIO_INFORMES = '17367115'
const MAXIMO_INFORMES = 8 // por rodada; os repetidos o banco já ignora pela URL

export async function coletarOpenFinance() {
  const itens = []

  const espacos = [
    { chave: 'OF', nome: 'Área do Desenvolvedor' },
    { chave: 'DraftOF', nome: 'Draft — Área do Desenvolvedor' },
  ]
  for (const espaco of espacos) {
    const url =
      `${WIKI}/rest/api/content/search` +
      `?cql=space=${espaco.chave}%20order%20by%20lastmodified%20desc&limit=15&expand=version`
    const dados = await buscarJson(url)
    for (const pagina of dados.results ?? []) {
      const versao = pagina.version?.number ?? 1
      const caminho = pagina._links?.webui ?? `/pages/${pagina.id}`
      itens.push({
        fonte: 'Open Finance',
        categoria: 'Wiki',
        titulo: `${pagina.title} (v${versao})`,
        resumo: `Página atualizada no wiki do Open Finance Brasil — espaço "${espaco.nome}".`,
        // o número da versão na URL faz cada alteração contar como novidade
        url: `${WIKI}${caminho}#v${versao}`,
        data_publicacao: pagina.version?.when ?? null,
      })
    }
  }

  try {
    const entradas = await buscarAtom('https://github.com/OpenBanking-Brasil/openapi/releases.atom')
    for (const entrada of entradas.slice(0, 10)) {
      itens.push({
        fonte: 'Open Finance',
        categoria: 'Release',
        titulo: `Especificações (GitHub) — ${textoDoAtom(entrada.title)}`,
        resumo: resumir(textoDoAtom(entrada.content)),
        url: linkDoAtom(entrada),
        data_publicacao: entrada.updated ?? null,
      })
    }
  } catch (erro) {
    console.warn(`  aviso: releases do GitHub falharam (${erro.message}) — seguindo sem eles`)
  }

  try {
    itens.push(...(await coletarInformes()))
  } catch (erro) {
    console.warn(`  aviso: Repositório de Informes falhou (${erro.message}) — seguindo sem ele`)
  }

  return itens
}

/* ---------- Informes (boletins "Informa" enviados por e-mail) ---------- */

// A tabela do Repositório tem 3 colunas: Link (eepurl.com), Descrição
// (a lista de tópicos do boletim) e Data de envio. Cada <tr> vira
// { url, topicos, dataEnvio }; linhas sem link ou sem data (o cabeçalho,
// por exemplo) são ignoradas. A função é pura para poder ser testada.
export function extrairInformes(html) {
  const informes = []
  for (const linha of String(html).split(/<tr[\s>]/).slice(1)) {
    const url = linha.match(/href="(https?:\/\/eepurl\.com\/[^"]+)"/)?.[1]
    const dataEnvio = linha.match(/datetime="(\d{4}-\d{2}-\d{2})"/)?.[1]
    if (!url || !dataEnvio) continue
    const topicos = [...linha.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
      .map((m) => limparHtml(m[1]))
      .filter(Boolean)
    informes.push({ url, topicos, dataEnvio })
  }
  return informes
}

// O título oficial ("[Open Finance] Informa #938") só aparece na página do
// boletim — seguimos o link para buscá-lo; se falhar, montamos um genérico.
async function tituloDoInforme(url, dataEnvio) {
  const [ano, mes, dia] = dataEnvio.split('-')
  const reserva = `[Open Finance] Informa — envio ${dia}/${mes}/${ano}`
  try {
    const html = await buscarTexto(url)
    const titulo = limparHtml(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
    return titulo || reserva
  } catch {
    return reserva
  }
}

async function coletarInformes() {
  const pagina = await buscarJson(
    `${WIKI}/rest/api/content/${PAGINA_REPOSITORIO_INFORMES}?expand=body.view`,
  )
  const informes = extrairInformes(pagina.body?.view?.value ?? '').slice(0, MAXIMO_INFORMES)
  const itens = []
  for (const informe of informes) {
    itens.push({
      fonte: 'Open Finance',
      categoria: 'Comunicado',
      titulo: await tituloDoInforme(informe.url, informe.dataEnvio),
      // um tópico por linha, com marcador — as telas mostram como lista
      resumo: informe.topicos.map((t) => `• ${t}`).join('\n'),
      url: informe.url,
      // meio-dia de Brasília: o dia fica certo em qualquer fuso
      data_publicacao: new Date(`${informe.dataEnvio}T12:00:00-03:00`).toISOString(),
    })
  }
  return itens
}
