// Deep-link: o estado da tela vira parâmetros na URL (?aba=radar&card=12),
// sem react-router. Copiar o link da barra = compartilhar exatamente esta
// visão (aba, filtros do feed e card aberto do radar) no Teams.
// Usamos history.replaceState para trocar a URL sem recarregar a página
// e sem encher o histórico do navegador (o botão Voltar continua normal).
import { FILTROS_INICIAIS } from './api.js'

// Filtro do feed ↔ nome do parâmetro na URL
const PARAMETROS_FILTRO = [
  ['busca', 'busca'],
  ['fonte', 'fonte'],
  ['categoria', 'categoria'],
  ['tema', 'tema'],
  ['periodo', 'periodo'],
  ['dataInicio', 'inicio'],
  ['dataFim', 'fim'],
  ['ordem', 'ordem'],
]

// Lê a URL na abertura do site e devolve { aba, filtros, cardAberto }
// (null = a URL não trouxe nada; a tela usa o padrão de sempre)
export function lerEstadoDaUrl() {
  const params = new URLSearchParams(window.location.search)
  const filtros = { ...FILTROS_INICIAIS }
  let veioFiltro = false
  for (const [chave, nome] of PARAMETROS_FILTRO) {
    const valor = params.get(nome)
    if (valor) {
      filtros[chave] = valor
      veioFiltro = true
    }
  }
  if (params.get('arquivadas') === '1') {
    filtros.arquivadas = true
    veioFiltro = true
  }
  return {
    aba: params.get('aba'),
    filtros: veioFiltro ? filtros : null,
    cardAberto: params.get('card'),
  }
}

// Espelha o estado atual na URL — só entra o que fugiu do padrão,
// para o link ficar curto e legível
export function gravarEstadoNaUrl({ aba, filtros, cardAberto }) {
  const params = new URLSearchParams()
  if (aba && aba !== 'feed') params.set('aba', aba)
  for (const [chave, nome] of PARAMETROS_FILTRO) {
    if (filtros?.[chave]) params.set(nome, filtros[chave])
  }
  if (filtros?.arquivadas) params.set('arquivadas', '1')
  if (cardAberto) params.set('card', cardAberto)
  const consulta = params.toString()
  const url = window.location.pathname + (consulta ? `?${consulta}` : '') + window.location.hash
  window.history.replaceState(null, '', url)
}
