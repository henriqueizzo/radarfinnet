// Comunicações regulatórias recebidas pelos CANAIS FECHADOS do Banco Central
// e das estruturas de governança (BC Correio, UNICAD, Protocolo Digital…).
// Esses sistemas exigem login da instituição — o robô não os alcança —,
// então o time REGISTRA aqui o que chega, e o sistema classifica, cobra
// prazo e sugere um plano de ação.

export const CANAIS_COMUNICACAO = [
  'BC Correio',
  'Protocolo Digital',
  'UNICAD',
  'Siscom/Siscon',
  'CRD',
  'Carta/Ofício do BC',
  'Governança Open Finance',
  'Outro canal oficial',
]

// Classificação do evento regulatório (item 1 do fluxo de tratamento)
export const TIPOS_EVENTO = [
  'Informação',
  'Solicitação',
  'Exigência',
  'Fiscalização',
  'Supervisão',
  'Prazo regulatório',
  'Processo administrativo',
  'Consulta pública',
]

export const STATUS_RESPOSTA = ['Sem resposta', 'Em andamento', 'Respondida']

// Quantos dias faltam para o prazo (negativo = vencido; null = sem prazo).
// O prazo é um date "AAAA-MM-DD" — comparamos só os dias, sem horário.
export function diasParaPrazo(prazo) {
  if (!prazo) return null
  const [ano, mes, dia] = String(prazo).split('-').map(Number)
  if (!ano || !mes || !dia) return null
  const dataPrazo = new Date(ano, mes - 1, dia)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((dataPrazo - hoje) / (24 * 60 * 60 * 1000))
}

// "AAAA-MM-DD" → "dd/mm/aaaa" (sem criar fuso errado)
export function prazoPorExtenso(prazo) {
  const [ano, mes, dia] = String(prazo ?? '').split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : ''
}

/* ---------- Sugestão automática de plano de ação (item 3 do fluxo) ---------- */

// Primeiros passos típicos de cada tipo de evento
const PASSOS_POR_TIPO = {
  Informação: [
    'Ler a comunicação na íntegra e avaliar se há impacto para a Finnet',
    'Compartilhar com as áreas potencialmente afetadas',
    'Arquivar com registro de ciência se não houver ação necessária',
  ],
  Solicitação: [
    'Confirmar o recebimento pelo mesmo canal oficial',
    'Levantar as informações/documentos solicitados com a área responsável',
    'Preparar e revisar a resposta antes do envio',
    'Protocolar a resposta pelo canal de origem e guardar o comprovante',
  ],
  Exigência: [
    'Registrar ciência e dar conhecimento imediato à Diretoria',
    'Designar formalmente o responsável pelo atendimento',
    'Montar o plano de adequação com etapas e datas internas',
    'Responder dentro do prazo pelo canal de origem, com evidências',
  ],
  Fiscalização: [
    'Comunicar imediatamente Diretoria e Compliance',
    'Centralizar o atendimento em um único ponto de contato',
    'Separar os documentos requeridos e controlar o que foi entregue',
    'Registrar todas as interações com a equipe de fiscalização',
  ],
  Supervisão: [
    'Registrar a demanda de supervisão e o supervisor responsável',
    'Levantar os dados/documentos pedidos com as áreas',
    'Validar a resposta com Compliance antes do envio',
    'Acompanhar desdobramentos até o encerramento formal',
  ],
  'Prazo regulatório': [
    'Confirmar a data-limite e a base normativa do prazo',
    'Criar marcos internos com folga antes do prazo oficial',
    'Acompanhar semanalmente o avanço até a entrega',
  ],
  'Processo administrativo': [
    'Encaminhar ao jurídico e à Diretoria no mesmo dia',
    'Conferir prazo de defesa/recurso e protocolar tempestivamente',
    'Reunir documentos e evidências de suporte',
    'Acompanhar as movimentações do processo',
  ],
  'Consulta pública': [
    'Avaliar o impacto da proposta nos produtos da Finnet',
    'Decidir com a Diretoria se a Finnet enviará contribuição',
    'Preparar a contribuição e submeter dentro do prazo da consulta',
  ],
}

// Monta o texto sugerido do plano de ação a partir do que foi preenchido.
// É só um ponto de partida — o time edita à vontade antes de salvar.
export function sugerirPlanoAcao({ tipo, canal, prazo, area, documentos, reporte }) {
  const linhas = []
  const passos = PASSOS_POR_TIPO[tipo] ?? PASSOS_POR_TIPO['Informação']
  passos.forEach((passo, i) => linhas.push(`${i + 1}. ${passo}`))

  if (area) linhas.push(`${linhas.length + 1}. Acionar a área responsável: ${area}`)
  if (documentos) linhas.push(`${linhas.length + 1}. Reunir os documentos requeridos: ${documentos}`)
  if (reporte) linhas.push(`${linhas.length + 1}. Levar ao conhecimento da Diretoria/Conselho`)

  if (prazo) {
    const dias = diasParaPrazo(prazo)
    const urgencia =
      dias !== null && dias < 0
        ? ' — ATENÇÃO: prazo VENCIDO, priorizar imediatamente'
        : dias !== null && dias <= 7
          ? ` — restam ${dias} dia(s)`
          : ''
    linhas.push(`${linhas.length + 1}. Concluir e responder até ${prazoPorExtenso(prazo)}${urgencia}`)
  }
  if (canal) linhas.push(`${linhas.length + 1}. Registrar a resposta no canal de origem (${canal}) e atualizar o status aqui`)

  return linhas.join('\n')
}
