// Etapas do kanban do Radar — compartilhadas entre o quadro (Radar.jsx)
// e a janela de detalhes (componentes/JanelaDetalhe.jsx).

export const STATUS = ['Encontrado', 'Avaliando', 'Desenvolvimento', 'Entregue']

export const ROTULOS = {
  Encontrado: '🔎 Encontrado',
  Avaliando: '🧐 Avaliando',
  Desenvolvimento: '🛠️ Desenvolvimento',
  Entregue: '✅ Entregue',
}

export const FAIXAS = {
  Encontrado: 'faixa-amarelo',
  Avaliando: 'faixa-azul',
  Desenvolvimento: 'faixa-azul',
  Entregue: 'faixa-verde',
}

export const VAZIOS = {
  Encontrado: 'Nada por aqui — o coletor adiciona normativos sozinho, ou use "Enviar ao Radar" no Feed.',
  Avaliando: 'Nenhuma mudança em avaliação.',
  Desenvolvimento: 'Nada em desenvolvimento no momento.',
  Entregue: 'Nenhuma entrega concluída ainda.',
}
