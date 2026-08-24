// Funções de apoio usadas em várias telas.

// "há 2 h", "ontem", "há 5 d" — a data completa vai no title (tooltip)
export function tempoRelativo(iso) {
  if (!iso) return 'sem data'
  const data = new Date(iso)
  const segundos = (Date.now() - data.getTime()) / 1000
  if (segundos < 60) return 'agora'
  if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`
  if (segundos < 86400) return `há ${Math.floor(segundos / 3600)} h`
  const dias = Math.floor(segundos / 86400)
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} d`
  return data.toLocaleDateString('pt-BR')
}

export function dataCompleta(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR') : 'sem data'
}

// "19/08/2026" — data curta para os cards (a completa vai no tooltip)
export function dataCurta(iso) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : 'sem data'
}

// Alguns resumos do coletor são uma lista de tópicos, um por linha com "• "
// (é assim que os Informes do Open Finance chegam). Devolve os tópicos —
// ou null quando o resumo é texto corrido normal.
export function topicosDoResumo(resumo) {
  const topicos = String(resumo ?? '')
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.startsWith('• '))
    .map((linha) => linha.slice(2).trim())
  return topicos.length > 0 ? topicos : null
}

// A notícia é um boletim "Informa" do Open Finance? (o card mostra
// "envio dd/mm/aaaa" em vez de "há X dias")
export function ehInforme(noticia) {
  return (
    /\bInforma\s*#\d+/.test(noticia?.titulo ?? '') ||
    String(noticia?.url ?? '').includes('eepurl.com')
  )
}

// "Maria Silva" → "MS" · "henrique@finnet.com.br" → "HE"
export function iniciais(texto) {
  const limpo = String(texto ?? '')
    .split('@')[0]
    .replace(/[^a-zA-ZÀ-ú]+/g, ' ')
    .trim()
  const partes = limpo.split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return (partes[0][0] + (partes[1]?.[0] ?? partes[0][1] ?? '')).toUpperCase()
}

// Temas exibidos de uma notícia = automáticos (do coletor) + manuais
// (adicionados pelo time), sem repetir os que aparecem nos dois
export function temasDaNoticia(noticia) {
  const automaticos = noticia?.temas ?? []
  const manuais = (noticia?.temas_manuais ?? []).filter((t) => !automaticos.includes(t))
  return { automaticos, manuais, todos: [...automaticos, ...manuais] }
}

// "2026-08-16" no fuso local — para nomear os arquivos exportados
export function dataParaArquivo() {
  const d = new Date()
  const dois = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

// Busca que ignora acentos: "resolucao" encontra "Resolução"
export function semAcentos(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
