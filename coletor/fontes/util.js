// Ferramentas compartilhadas por todas as fontes do coletor.
import { XMLParser } from 'fast-xml-parser'

// Os sites do gov.br e da Febraban bloqueiam robôs "assumidos";
// por isso nos apresentamos como um navegador comum.
export const CABECALHO_NAVEGADOR = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

export async function buscarJson(url, extras = {}) {
  const resposta = await fetch(url, {
    headers: { ...CABECALHO_NAVEGADOR, Accept: 'application/json', ...extras },
  })
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url}`)
  return resposta.json()
}

export async function buscarTexto(url, extras = {}) {
  const resposta = await fetch(url, { headers: { ...CABECALHO_NAVEGADOR, ...extras } })
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url}`)
  return resposta.text()
}

// Lê um feed Atom/RSS e devolve a lista de entradas.
// processEntities: false — o feed do BCB tem milhares de entidades HTML e
// estoura o limite de segurança do parser; quem decodifica é o limparHtml.
const parserXml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  processEntities: false,
})

export async function buscarAtom(url) {
  const xml = await buscarTexto(url, { Accept: 'application/atom+xml, application/xml, text/xml' })
  const documento = parserXml.parse(xml)
  const feed = documento.feed ?? documento.rss?.channel
  return comoLista(feed?.entry ?? feed?.item)
}

// No Atom, o link pode vir como texto, objeto ou lista — normaliza tudo.
export function linkDoAtom(entrada) {
  const links = comoLista(entrada.link)
  const escolhido = links.find((l) => l?.['@rel'] === 'alternate') ?? links[0]
  const href = typeof escolhido === 'string' ? escolhido : escolhido?.['@href']
  const url = href ?? (typeof entrada.id === 'string' ? entrada.id : '')
  // como o parser não expande entidades, o & vem como &amp; dentro da URL
  return url.replace(/&amp;/g, '&')
}

// Campos de texto do Atom podem vir como { '#text': ... } quando têm atributos.
export function textoDoAtom(campo) {
  if (campo == null) return ''
  if (typeof campo === 'object') return limparHtml(campo['#text'] ?? '')
  return limparHtml(campo)
}

// Remove tags HTML e decodifica entidades, deixando texto puro.
export function limparHtml(texto = '') {
  return String(texto)
    .replace(/&amp;/gi, '&')                                            // 1º: "&amp;lt;" vira "&lt;"
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, numero) => String.fromCodePoint(Number(numero)))
    .replace(/<[^>]*>/g, ' ')                                           // tags que estavam codificadas
    .replace(/\s+/g, ' ')
    .trim()
}

export function resumir(texto, maximo = 400) {
  const limpo = limparHtml(texto)
  return limpo.length > maximo ? limpo.slice(0, maximo - 1).trimEnd() + '…' : limpo
}

export function comoLista(valor) {
  if (valor == null) return []
  return Array.isArray(valor) ? valor : [valor]
}
