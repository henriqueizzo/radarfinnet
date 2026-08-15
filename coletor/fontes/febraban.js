// Febraban — endpoint JSON interno da página de notícias.
// Não é documentado: se um dia parar de funcionar, ver docs/fontes-de-dados.md
import { buscarJson, limparHtml, resumir } from './util.js'

export async function coletarFebraban() {
  const dados = await buscarJson(
    'https://portal.febraban.org.br/Noticias/GetItems?page=1&selectedData=&selectedText=',
  )

  const itens = []
  for (const noticia of dados.Items ?? []) {
    // A data vem no formato antigo do ASP.NET: "\/Date(1786590000000)\/"
    const epoch = /\/Date\((\d+)\)\//.exec(noticia.Publicar ?? '')?.[1]
    itens.push({
      fonte: 'Febraban',
      categoria: 'Notícia',
      titulo: limparHtml(noticia.Descricaop ?? ''),
      resumo: resumir(noticia.Resumop ?? ''),
      url: `https://portal.febraban.org.br/noticia/${noticia.IdTexto}/pt-br/`,
      data_publicacao: epoch ? new Date(Number(epoch)).toISOString() : null,
    })
  }
  return itens.filter((item) => item.titulo && item.url.includes('/noticia/'))
}
