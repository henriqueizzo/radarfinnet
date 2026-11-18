// Google News em RSS: busca pública e gratuita, sem chave de API.
// Duas buscas por banco:
//   1) site:<domínio do banco>  → o que o PRÓPRIO banco publica
//   2) "<nome do banco>" + termos → o que sai na imprensa sobre o banco
// Testado em 12/11/2026: ~100 consultas seguidas sem bloqueio.
// (DuckDuckGo e Bing foram descartados: bloqueiam depois de 2 buscas ou
//  ignoram o filtro site:.)
import { buscarAtom, limparHtml, textoDoAtom } from '../fontes/util.js'

const TERMOS = '("split payment" OR "reforma tributária" OR IBS OR CBS)'

export function urlBusca(consulta) {
  return (
    'https://news.google.com/rss/search?q=' +
    encodeURIComponent(consulta) +
    '&hl=pt-BR&gl=BR&ceid=BR:pt-419'
  )
}

export function consultaSite(dominio) {
  return `site:${dominio} ${TERMOS}`
}

// Levantamento das documentações de layout publicadas pelo banco
// (páginas de "Layout de arquivos", manuais CNAB 240/400, padrões
// Febraban). Sem limite de data: o objetivo é ter o catálogo completo.
// O Google devolve muita página genérica do banco; o filtro pelo TÍTULO
// (assunto Layout/Documentação em analise.js) separa o que interessa.
const TERMOS_LAYOUT = '(layout OR leiaute OR CNAB OR "manual técnico" OR "240 posições" OR "400 posições" OR "especificação técnica" OR "arquivo retorno")'

export function consultaLayout(dominio) {
  return `site:${dominio} ${TERMOS_LAYOUT}`
}

// Imprensa: só os últimos 90 dias (o histórico vem pelos sites dos bancos)
export function consultaNome(nome) {
  return `"${nome}" ${TERMOS} when:90d`
}

// O título do Google News vem como "Título da matéria - Veículo"
export function separarVeiculo(titulo, veiculo) {
  const limpo = limparHtml(titulo)
  if (veiculo && limpo.endsWith(` - ${veiculo}`)) return limpo.slice(0, -(veiculo.length + 3)).trim()
  const corte = limpo.lastIndexOf(' - ')
  return corte > 20 ? limpo.slice(0, corte).trim() : limpo
}

// Converte cada <item> do RSS num objeto simples
export function lerItem(item) {
  const fonte = item.source ?? {}
  const veiculo = typeof fonte === 'object' ? textoDoAtom(fonte) : limparHtml(fonte)
  const siteVeiculo = typeof fonte === 'object' ? (fonte['@url'] ?? '') : ''
  const data = item.pubDate ? new Date(item.pubDate) : null
  return {
    titulo: separarVeiculo(textoDoAtom(item.title), veiculo),
    url: String(item.link ?? '').replace(/&amp;/g, '&').trim(),
    veiculo,
    siteVeiculo,
    data_publicacao: data && !Number.isNaN(data.getTime()) ? data.toISOString() : null,
  }
}

export async function buscarGoogleNews(consulta) {
  const itens = await buscarAtom(urlBusca(consulta))
  return itens.map(lerItem).filter((i) => i.titulo && i.url.startsWith('http'))
}

// O site de onde a matéria veio é um dos domínios oficiais do banco?
export function ehDoBanco(siteVeiculo, dominios) {
  let host = ''
  try {
    host = new URL(siteVeiculo).host.toLowerCase()
  } catch {
    return false
  }
  return dominios.some((d) => host === d || host.endsWith(`.${d}`))
}
