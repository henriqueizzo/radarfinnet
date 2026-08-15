// Banco Central do Brasil — feeds Atom oficiais (sem autenticação).
// Detalhes e URLs verificadas: docs/fontes-de-dados.md
import { buscarAtom, linkDoAtom, textoDoAtom, resumir } from './util.js'

export async function coletarBCB() {
  const ano = new Date().getFullYear()
  const grupos = [
    {
      url: `https://www.bcb.gov.br/api/feed/app/normativos/normativos?ano=${ano}`,
      categoria: 'Normativo', // Resoluções BCB/CMN e Instruções Normativas
    },
    {
      url: `https://www.bcb.gov.br/api/feed/app/demaisnormativos/atosecomunicados?ano=${ano}`,
      categoria: 'Comunicado',
    },
    {
      url: 'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/noticias',
      categoria: 'Notícia',
    },
  ]

  const itens = []
  for (const grupo of grupos) {
    const entradas = await buscarAtom(grupo.url)
    for (const entrada of entradas.slice(0, 40)) {
      let url = linkDoAtom(entrada)
      if (url.startsWith('/')) url = 'https://www.bcb.gov.br' + url
      if (!url) continue
      itens.push({
        fonte: 'Banco Central',
        categoria: grupo.categoria,
        titulo: textoDoAtom(entrada.title).replace(/^BC\s*-\s*/, ''),
        resumo: resumir(textoDoAtom(entrada.summary ?? entrada.content)),
        url,
        data_publicacao: entrada.updated ?? entrada.published ?? null,
      })
    }
  }
  return itens
}
