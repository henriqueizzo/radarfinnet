// Open Finance Brasil — duas frentes:
// 1) o wiki público (Confluence) aceita a API REST sem login: pegamos as
//    páginas alteradas mais recentemente em cada espaço;
// 2) os releases das especificações no GitHub (feed Atom, sem limite de uso).
// O site institucional openfinancebrasil.org.br é bloqueado por firewall — não usamos.
import { buscarJson, buscarAtom, linkDoAtom, textoDoAtom, resumir } from './util.js'

const WIKI = 'https://openfinancebrasil.atlassian.net/wiki'

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

  return itens
}
