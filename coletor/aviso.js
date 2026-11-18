// Aviso ao time por e-mail (Resend) e/ou Teams. Usado pelo coletor
// regulatório e pelo da vertical Split Payment & Reforma Tributária.
// Sem as variáveis de ambiente, só avisa no log e segue em frente;
// uma falha aqui NUNCA derruba a coleta.
//
//   RESEND_API_KEY + DIGEST_PARA  → e-mail
//   TEAMS_WEBHOOK_URL             → cartão no canal do Teams
//
// itens = [{ titulo, url, detalhe }]
export async function enviarAviso({ assunto, cabecalho, itens, rodape = '' }) {
  const chaveResend = process.env.RESEND_API_KEY
  const destinatarios = process.env.DIGEST_PARA
  const webhookTeams = process.env.TEAMS_WEBHOOK_URL
  if (!(chaveResend && destinatarios) && !webhookTeams) {
    console.log('📭 Digest desativado (defina RESEND_API_KEY + DIGEST_PARA e/ou TEAMS_WEBHOOK_URL para receber alertas)')
    return
  }

  const escapar = (texto) =>
    String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  if (chaveResend && destinatarios) {
    try {
      const html = [
        `<h2>${escapar(cabecalho)}</h2>`,
        '<ul>',
        ...itens.map(
          (i) => `<li><a href="${escapar(i.url)}">${escapar(i.titulo)}</a>${i.detalhe ? ` — ${escapar(i.detalhe)}` : ''}</li>`,
        ),
        '</ul>',
        rodape ? `<p>${escapar(rodape)}</p>` : '',
      ].join('\n')
      const resposta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${chaveResend}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Radar Regulatório <onboarding@resend.dev>',
          to: destinatarios.split(',').map((e) => e.trim()),
          subject: assunto,
          html,
        }),
        signal: AbortSignal.timeout(15000),
      })
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${await resposta.text()}`)
      console.log(`📧 Digest enviado por e-mail para ${destinatarios}`)
    } catch (erro) {
      console.warn(`  aviso: digest por e-mail falhou (${erro.message}) — a coleta segue normal`)
    }
  }

  if (webhookTeams) {
    try {
      const cartao = {
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
              type: 'AdaptiveCard',
              version: '1.4',
              body: [
                { type: 'TextBlock', size: 'Medium', weight: 'Bolder', text: cabecalho, wrap: true },
                ...itens.map((i) => ({
                  type: 'TextBlock',
                  text: `• [${i.titulo}](${i.url})${i.detalhe ? ` — ${i.detalhe}` : ''}`,
                  wrap: true,
                })),
                ...(rodape ? [{ type: 'TextBlock', isSubtle: true, text: rodape, wrap: true }] : []),
              ],
            },
          },
        ],
      }
      const resposta = await fetch(webhookTeams, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cartao),
        signal: AbortSignal.timeout(15000),
      })
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${await resposta.text()}`)
      console.log('💬 Digest enviado ao Teams')
    } catch (erro) {
      console.warn(`  aviso: digest no Teams falhou (${erro.message}) — a coleta segue normal`)
    }
  }
}
