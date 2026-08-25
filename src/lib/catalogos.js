// Catálogos usados nos filtros do Feed e na edição manual de temas
// (compartilhados entre abas/Feed.jsx e componentes/JanelaDetalhe.jsx).

export const FONTES = ['Banco Central', 'Coaf', 'Febraban', 'Open Finance']

export const CATEGORIAS = ['Normativo', 'Comunicado', 'Consulta Pública', 'Notícia', 'Wiki', 'Release']

// Mesmo catálogo de etiquetas que o coletor aplica (coletor/temas.js)
export const TEMAS = [
  'Pix',
  'Open Finance',
  'Instituições de Pagamento',
  'PLD/FT',
  'Duplicata Escritural',
  'Cobrança/Boleto',
  'LGPD',
  'Cibersegurança',
]

export const PERIODOS = [
  ['', 'Qualquer data'],
  ['7d', 'Últimos 7 dias'],
  ['30d', 'Últimos 30 dias'],
  ['personalizado', 'Escolher período…'],
]

// Ordem de importância das categorias quando o feed é ordenado
// "por prioridade": 01 Normativos → 02 Comunicados/Consultas → 03 o resto.
// (Espelha a coluna prioridade calculada pelo banco — supabase/schema.sql)
export function prioridadeDaCategoria(categoria) {
  if (categoria === 'Normativo') return 1
  if (categoria === 'Comunicado' || categoria === 'Consulta Pública') return 2
  return 3
}

export const GRUPOS_PRIORIDADE = {
  1: '01 · Normativos',
  2: '02 · Comunicados e Consultas Públicas',
  3: '03 · Notícias e demais',
}

export const ORDENS = [
  ['', 'Mais recentes primeiro'],
  ['prioridade', 'Por prioridade (01 Normativos · 02 Comunicados · 03 Notícias)'],
]
