// Coaf — API REST do portal gov.br (Plone). Funciona sem login,
// mas só na raiz do site e com User-Agent de navegador.
import { buscarJson, resumir } from './util.js'

export async function coletarCoaf() {
  const url =
    'https://www.gov.br/coaf/++api++/@search' +
    '?portal_type=News+Item&sort_on=effective&sort_order=descending&b_size=25'
  const dados = await buscarJson(url)

  return (dados.items ?? [])
    .map((item) => ({
      fonte: 'Coaf',
      categoria: 'Notícia',
      titulo: item.title ?? '',
      resumo: resumir(item.description ?? ''),
      // o @id vem com o marcador interno ++api++ — removemos para virar o link normal
      url: String(item['@id'] ?? '').replace('/++api++', ''),
      data_publicacao: item.effective ?? null,
    }))
    .filter((item) => item.url && item.titulo)
}
