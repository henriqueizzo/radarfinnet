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

// Busca que ignora acentos: "resolucao" encontra "Resolução"
export function semAcentos(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
