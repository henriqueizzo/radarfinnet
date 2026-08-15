// 🧪 MODO DEMONSTRAÇÃO
// Quando o Supabase ainda não foi configurado (src/lib/config.js), o site
// abre com estes dados de exemplo — itens REAIS capturados pelo coletor em
// 15/08/2026 — para dar para ver e apresentar o sistema antes de configurar.
// Nada aqui é gravado: mover cards e salvar só vale enquanto a página está aberta.

const AGORA = Date.now()
const horasAtras = (h) => new Date(AGORA - h * 60 * 60 * 1000).toISOString()

export const NOTICIAS_DEMO = [
  {
    id: 'demo-n1',
    fonte: 'Banco Central',
    categoria: 'Normativo',
    titulo: 'Resolução BCB N° 584 de 07/08/2026',
    resumo:
      'Altera o regulamento anexo à Resolução BCB nº 80, que disciplina a constituição e o funcionamento das instituições de pagamento e os requisitos de autorização.',
    url: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20BCB&numero=584',
    data_publicacao: horasAtras(96),
    temas: ['Instituições de Pagamento'],
    criado_em: horasAtras(2),
  },
  {
    id: 'demo-n2',
    fonte: 'Banco Central',
    categoria: 'Normativo',
    titulo: 'Instrução Normativa BCB N° 766 de 27/07/2026',
    resumo:
      'Divulga a versão atualizada do Manual de Padrões para Iniciação do Pix, com ajustes nos fluxos de iniciação de pagamento aplicáveis às instituições participantes.',
    url: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Instru%C3%A7%C3%A3o%20Normativa%20BCB&numero=766',
    data_publicacao: horasAtras(200),
    temas: ['Pix', 'Open Finance'],
    criado_em: horasAtras(2),
  },
  {
    id: 'demo-n3',
    fonte: 'Coaf',
    categoria: 'Notícia',
    titulo: 'Comunicado Siscoaf 109 – 27/07/2026',
    resumo:
      'Comunicado às pessoas obrigadas sobre atualização de procedimentos de comunicação de operações suspeitas no Siscoaf.',
    url: 'https://www.gov.br/coaf/pt-br/sistemas/siscoaf/comunicados-siscoaf/comunicado-siscoaf-109-23-07-2026',
    data_publicacao: horasAtras(210),
    temas: ['PLD/FT'],
    criado_em: horasAtras(2),
  },
  {
    id: 'demo-n4',
    fonte: 'Banco Central',
    categoria: 'Comunicado',
    titulo: 'Comunicado N° 45.757 de 14/08/2026',
    resumo:
      'Divulga procedimentos operacionais e cronograma aplicáveis aos participantes de arranjo de pagamento no âmbito do Sistema de Pagamentos Brasileiro.',
    url: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Comunicado&numero=45757',
    data_publicacao: horasAtras(20),
    temas: ['Instituições de Pagamento'],
    criado_em: horasAtras(2),
  },
  {
    id: 'demo-n5',
    fonte: 'Open Finance',
    categoria: 'Wiki',
    titulo: 'API de Iniciação de Pagamentos v4 (v127)',
    resumo: 'Página atualizada no wiki do Open Finance Brasil — espaço "Área do Desenvolvedor".',
    url: 'https://openfinancebrasil.atlassian.net/wiki/spaces/OF/overview',
    data_publicacao: horasAtras(14),
    temas: ['Open Finance', 'Pix'],
    criado_em: horasAtras(2),
  },
  {
    id: 'demo-n6',
    fonte: 'Febraban',
    categoria: 'Notícia',
    titulo: 'FEBRABAN TECH 2026 debate IA, Pix e o futuro do sistema financeiro',
    resumo:
      'Evento reúne o setor bancário em São Paulo entre 24 e 26 de agosto, com painéis sobre inteligência artificial, Open Finance e segurança cibernética.',
    url: 'https://portal.febraban.org.br/noticia/4485/pt-br/',
    data_publicacao: horasAtras(30),
    temas: ['Pix', 'Open Finance', 'Cibersegurança'],
    criado_em: horasAtras(2),
  },
  {
    id: 'demo-n7',
    fonte: 'Coaf',
    categoria: 'Normativo',
    titulo: 'Resolução Coaf nº 40, de 22/07/2026',
    resumo:
      'Dispõe sobre os procedimentos de comunicação de operações suspeitas de lavagem de dinheiro ou financiamento do terrorismo pelas pessoas obrigadas.',
    url: 'https://www.in.gov.br/web/dou/-/resolucao-coaf-exemplo',
    data_publicacao: horasAtras(580),
    temas: ['PLD/FT'],
    criado_em: horasAtras(2),
  },
  {
    id: 'demo-n8',
    fonte: 'Open Finance',
    categoria: 'Release',
    titulo: 'Especificações (GitHub) — Release v1.4.2 das APIs',
    resumo: 'Nova versão publicada das especificações OpenAPI do Open Finance Brasil.',
    url: 'https://github.com/OpenBanking-Brasil/openapi/releases',
    data_publicacao: horasAtras(50),
    temas: ['Open Finance'],
    criado_em: horasAtras(2),
  },
  {
    id: 'demo-n9',
    fonte: 'Banco Central',
    categoria: 'Notícia',
    titulo: 'BC divulga agenda evolutiva do Pix com novas funcionalidades',
    resumo:
      'Autarquia detalha próximos passos do Pix, incluindo Pix Automático e melhorias na iniciação de pagamento via Open Finance.',
    url: 'https://www.bcb.gov.br/detalhenoticia/exemplo-agenda-pix',
    data_publicacao: horasAtras(75),
    temas: ['Pix', 'Open Finance'],
    criado_em: horasAtras(2),
  },
  {
    id: 'demo-n10',
    fonte: 'Banco Central',
    categoria: 'Normativo',
    titulo: 'Resolução BCB N° 540 de 12/03/2025 (Duplicata Escritural)',
    resumo:
      'Regulamenta o registro e a negociação de duplicatas escriturais e os requisitos aplicáveis às registradoras autorizadas.',
    url: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20BCB&numero=540',
    data_publicacao: horasAtras(900),
    temas: ['Duplicata Escritural'],
    criado_em: horasAtras(2),
  },
]

const noticia = (id) => NOTICIAS_DEMO.find((n) => n.id === id)

export const PERFIS_DEMO = [
  { id: 'demo-u1', nome: 'Henrique Izzo', email: 'henrique@finnet.com.br', is_admin: true, ativo: true, criado_em: horasAtras(720) },
  { id: 'demo-u2', nome: 'Fabiane Ceccato', email: 'fabiane@finnet.com.br', is_admin: false, ativo: true, criado_em: horasAtras(700) },
  { id: 'demo-u3', nome: 'Marcelo Souza', email: 'marcelo@finnet.com.br', is_admin: false, ativo: false, criado_em: horasAtras(650) },
]

export const ATIVIDADES_DEMO = [
  { id: 1, usuario_email: 'henrique@finnet.com.br', tipo: 'login', detalhe: '', noticia_id: null, criado_em: horasAtras(1), noticia: null },
  { id: 2, usuario_email: 'henrique@finnet.com.br', tipo: 'enviar_radar', detalhe: 'Resolução BCB N° 584 de 07/08/2026', noticia_id: 'demo-n1', criado_em: horasAtras(0.9), noticia: { titulo: 'Resolução BCB N° 584 de 07/08/2026' } },
  { id: 3, usuario_email: 'henrique@finnet.com.br', tipo: 'mover_status', detalhe: 'Encontrado → Avaliando — Instrução Normativa BCB N° 766', noticia_id: 'demo-n2', criado_em: horasAtras(0.8), noticia: { titulo: 'Instrução Normativa BCB N° 766 de 27/07/2026' } },
  { id: 4, usuario_email: 'fabiane@finnet.com.br', tipo: 'login', detalhe: '', noticia_id: null, criado_em: horasAtras(26), noticia: null },
  { id: 5, usuario_email: 'fabiane@finnet.com.br', tipo: 'editar_card', detalhe: 'Instrução Normativa BCB N° 766 de 27/07/2026', noticia_id: 'demo-n2', criado_em: horasAtras(25.6), noticia: { titulo: 'Instrução Normativa BCB N° 766 de 27/07/2026' } },
  { id: 6, usuario_email: 'fabiane@finnet.com.br', tipo: 'mover_status', detalhe: 'Avaliando → Desenvolvimento — Resolução Coaf nº 40', noticia_id: 'demo-n7', criado_em: horasAtras(25.2), noticia: { titulo: 'Resolução Coaf nº 40, de 22/07/2026' } },
  { id: 7, usuario_email: 'henrique@finnet.com.br', tipo: 'login', detalhe: '', noticia_id: null, criado_em: horasAtras(50), noticia: null },
  { id: 8, usuario_email: 'henrique@finnet.com.br', tipo: 'mover_status', detalhe: 'Desenvolvimento → Entregue — Resolução BCB N° 540', noticia_id: 'demo-n10', criado_em: horasAtras(49.5), noticia: { titulo: 'Resolução BCB N° 540 de 12/03/2025 (Duplicata Escritural)' } },
]

export const RADAR_DEMO = [
  {
    id: 'demo-r1',
    noticia_id: 'demo-n1',
    status: 'Encontrado',
    responsavel: '',
    observacoes: '',
    criado_em: horasAtras(2),
    atualizado_em: horasAtras(2),
    noticia: noticia('demo-n1'),
  },
  {
    id: 'demo-r2',
    noticia_id: 'demo-n2',
    status: 'Avaliando',
    responsavel: 'Fabiane Ceccato',
    observacoes: 'Verificar impacto no fluxo de iniciação Pix do Bankmanager e da Luna.',
    criado_em: horasAtras(30),
    atualizado_em: horasAtras(5),
    noticia: noticia('demo-n2'),
  },
  {
    id: 'demo-r3',
    noticia_id: 'demo-n7',
    status: 'Desenvolvimento',
    responsavel: 'Equipe Compliance',
    observacoes: 'Ajuste dos procedimentos internos de comunicação ao Siscoaf em andamento.',
    criado_em: horasAtras(300),
    atualizado_em: horasAtras(24),
    noticia: noticia('demo-n7'),
  },
  {
    id: 'demo-r4',
    noticia_id: 'demo-n10',
    status: 'Entregue',
    responsavel: 'Time Duplicatas',
    observacoes: 'Produto Duplicata Escritural adequado à resolução. Encerrado.',
    criado_em: horasAtras(800),
    atualizado_em: horasAtras(400),
    noticia: noticia('demo-n10'),
  },
]
