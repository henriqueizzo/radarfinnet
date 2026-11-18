// Vertical Split Payment & Reforma Tributária: catálogos da tela e
// sugestão de ação. A lista de bancos vem do próprio coletor, para a
// tela e o robô nunca divergirem.
export { NOMES_BANCOS } from '../../coletor/tributario/bancos.js'

export const ASSUNTOS_TRIB = ['Split Payment', 'Reforma Tributária', 'Layout/Documentação']
export const ICONE_ASSUNTO = { 'Split Payment': '💳', 'Reforma Tributária': '🧾', 'Layout/Documentação': '📐' }
export const ORIGENS_TRIB = ['Site do banco', 'Imprensa']
export const PRIORIDADES_TRIB = ['Alta', 'Média', 'Baixa']
export const STATUS_TRIB = ['Novo', 'Em análise', 'Ação definida', 'Concluído', 'Sem impacto', 'Histórico']
// "Em aberto" = o que ainda pede alguma tratativa do time
export const STATUS_ABERTOS = ['Novo', 'Em análise', 'Ação definida']

export const COR_PRIORIDADE = { Alta: 'vermelho', Média: 'amarelo', Baixa: 'cinza' }

export const MOTIVO_PRIORIDADE = {
  Alta: 'Split payment com sinal técnico (layout, prazo ou produto), publicado pelo próprio banco, ou layout que já trata de split/reforma',
  Média: 'Publicado pelo banco (inclui documentação de layout), split payment na imprensa ou regulamentação',
  Baixa: 'Reforma tributária em geral na imprensa',
}

// O que fazer diante de cada sinal, do ponto de vista da Finnet (EDI/VAN)
const PASSOS_POR_SINAL = {
  'Layout/Integração': 'Pedir ao banco o novo leiaute/especificação técnica e avaliar impacto nos conversores e na VAN da Finnet',
  'Prazo/Cronograma': 'Registrar as datas anunciadas no roadmap e conferir se a Finnet chega pronta antes do banco',
  'Produto/Solução': 'Entender a solução do banco: concorre, complementa ou abre oportunidade de integração com a Finnet?',
  'Regulamentação': 'Ler o texto oficial citado e levar ao time de Regulação para avaliar obrigações da Finnet',
  'Orientação a clientes': 'Usar como referência para o material de orientação aos clientes Finnet',
}

export function sugerirAcao(publicacao) {
  const passos = []
  passos.push(`Ler a publicação de ${publicacao.banco} na íntegra`)
  for (const sinal of publicacao.sinais ?? []) {
    if (PASSOS_POR_SINAL[sinal]) passos.push(PASSOS_POR_SINAL[sinal])
  }
  if ((publicacao.assuntos ?? []).includes('Layout/Documentação')) {
    passos.push('Baixar a documentação de layout, anotar versão e data, e comparar com o leiaute que a Finnet usa hoje nos conversores desse banco')
  }
  if ((publicacao.assuntos ?? []).includes('Split Payment')) {
    passos.push('Confirmar com o gerente de relacionamento do banco se haverá mudança nos arquivos de cobrança/pagamento trocados com a Finnet')
  }
  passos.push('Registrar a conclusão aqui e mudar o status (Ação definida, Concluído ou Sem impacto)')
  return passos.map((p, i) => `${i + 1}. ${p}`).join('\n')
}
