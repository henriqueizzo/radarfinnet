// ============================================================
// 🤖 COLETOR DO RADAR REGULATÓRIO
//
// O que ele faz, em ordem:
//   1. busca as novidades em cada fonte (BCB, Coaf, Febraban,
//      Open Finance e DOU);
//   2. etiqueta cada item com os temas Finnet (coletor/temas.js);
//   3. grava tudo no Supabase sem duplicar (a URL é única);
//   4. normativos com tema Finnet viram card "Encontrado" no Radar;
//   5. anota a saúde de cada fonte em coletas_execucoes;
//   6. avisa o time por e-mail/Teams quando algo novo entra no Radar.
//
// Rodar na mão:      npm run coletar
// Testar sem banco:  npm run coletar:teste
// Automático:        GitHub Actions (.github/workflows/coletor.yml)
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { coletarBCB } from './fontes/bcb.js'
import { coletarCoaf } from './fontes/coaf.js'
import { coletarFebraban } from './fontes/febraban.js'
import { coletarOpenFinance } from './fontes/openfinance.js'
import { coletarDOU } from './fontes/dou.js'
import { detectarTemas } from './temas.js'

const MODO_TESTE = process.argv.includes('--teste')
const TAMANHO_DO_LOTE = 100

const FONTES = [
  ['Banco Central', coletarBCB],
  ['Coaf (notícias)', coletarCoaf],
  ['Febraban', coletarFebraban],
  ['Open Finance', coletarOpenFinance],
  ['Coaf via DOU', coletarDOU],
]

async function principal() {
  console.log(`📡 Radar Regulatório — coleta iniciada${MODO_TESTE ? ' (MODO TESTE, nada será gravado)' : ''}\n`)

  // 1 + 2) coleta cada fonte, etiqueta os temas e anota como foi
  const coletados = []
  const execucoes = []
  for (const [nome, coletar] of FONTES) {
    const inicio = Date.now()
    const execucao = { fonte: nome, iniciada_em: new Date().toISOString(), duracao_ms: 0, itens: 0, erro: null }
    try {
      const itens = await coletar()
      for (const item of itens) item.temas = detectarTemas(`${item.titulo} ${item.resumo}`)
      console.log(`✅ ${nome}: ${itens.length} itens`)
      execucao.itens = itens.length
      coletados.push(...itens)
    } catch (erro) {
      // uma fonte fora do ar não derruba a coleta inteira
      execucao.erro = erro.message
      console.error(`❌ ${nome}: ${erro.message}`)
    }
    execucao.duracao_ms = Date.now() - inicio
    execucoes.push(execucao)
  }
  const fontesComErro = execucoes.filter((e) => e.erro).map((e) => e.fonte)

  // item sem título ou sem URL de verdade é pulado com aviso, não derruba a rodada
  const validos = []
  for (const item of coletados) {
    const tituloOk = typeof item.titulo === 'string' && item.titulo.trim() !== ''
    const urlOk = typeof item.url === 'string' && item.url.startsWith('http')
    if (tituloOk && urlOk) validos.push(item)
    else console.warn(`  aviso: item inválido pulado (titulo="${item.titulo ?? ''}" url="${item.url ?? ''}")`)
  }

  // remove repetidos dentro da própria rodada (mesma URL)
  const porUrl = new Map()
  for (const item of validos) {
    if (!porUrl.has(item.url)) porUrl.set(item.url, item)
  }
  const itens = [...porUrl.values()]
  console.log(`\n📦 Total da rodada: ${itens.length} itens únicos`)

  if (MODO_TESTE) {
    for (const item of itens.slice(0, 12)) {
      console.log(`\n[${item.fonte} · ${item.categoria}] ${item.titulo}`)
      console.log(`   data: ${item.data_publicacao ?? 'sem data'} | temas: ${item.temas.join(', ') || '—'}`)
      console.log(`   ${item.url}`)
    }
    const comTema = itens.filter((i) => i.temas.length > 0).length
    console.log(`\n🏷️  ${comTema} itens têm temas Finnet. Modo teste: nada foi gravado.`)
    return
  }

  // 3) grava no banco em lotes — URLs que já existem são ignoradas em silêncio
  const supabase = await conectarSupabase()
  const novos = []
  let falhaAoGravar = false
  for (let i = 0; i < itens.length; i += TAMANHO_DO_LOTE) {
    const lote = itens.slice(i, i + TAMANHO_DO_LOTE)
    const { data, error } = await supabase
      .from('noticias')
      .upsert(lote, { onConflict: 'url', ignoreDuplicates: true })
      .select('id, categoria, temas, titulo, url')
    if (error) {
      // um lote com problema não impede os próximos de tentar
      falhaAoGravar = true
      console.error(`❌ Supabase (noticias, lote ${Math.floor(i / TAMANHO_DO_LOTE) + 1}): ${error.message}`)
      continue
    }
    novos.push(...data)
  }
  console.log(`🆕 ${novos.length} novidades gravadas no banco`)

  // 4) normativos com tema Finnet entram no Radar como "Encontrado"
  const paraRadar = novos.filter(
    (n) => n.categoria === 'Normativo' && (n.temas ?? []).length > 0,
  )
  if (paraRadar.length > 0) {
    const { error: erroRadar } = await supabase
      .from('radar_itens')
      .upsert(paraRadar.map((n) => ({ noticia_id: n.id })), {
        onConflict: 'noticia_id',
        ignoreDuplicates: true,
      })
    if (erroRadar) {
      falhaAoGravar = true
      console.error(`❌ Supabase (radar): ${erroRadar.message}`)
    } else {
      console.log(`🎯 ${paraRadar.length} normativos enviados ao Radar:`)
      for (const n of paraRadar) console.log(`   • ${n.titulo}`)
    }
  }

  // 5) anota a saúde da rodada (a tabela pode ainda não existir — tudo bem)
  await registrarExecucoes(supabase, execucoes)

  // 6) avisa o time — o digest nunca derruba a coleta
  await enviarDigest(novos, paraRadar)

  // com fonte ou gravação falhando, sai com erro DEPOIS de gravar o que deu
  // certo — assim o GitHub Actions marca a rodada de vermelho
  if (fontesComErro.length > 0 || falhaAoGravar) {
    console.error(`\n⚠️ Coleta terminou com problemas${fontesComErro.length > 0 ? ` (fontes com erro: ${fontesComErro.join(', ')})` : ''}. O que deu certo foi gravado.`)
    process.exit(1)
  }
  console.log('\n✅ Coleta concluída.')
}

// Guarda uma linha por fonte em coletas_execucoes (saúde do robô).
async function registrarExecucoes(supabase, execucoes) {
  try {
    const { error } = await supabase.from('coletas_execucoes').insert(execucoes)
    if (error) throw new Error(error.message)
    console.log('🩺 Saúde da coleta registrada em coletas_execucoes')
  } catch (erro) {
    console.log(`ℹ️ Não registrei a saúde da coleta (${erro.message}) — aplique supabase/migracao-2026-08-16.sql e isso passa a funcionar.`)
  }
}

// Resumo por e-mail (Resend) e/ou Teams quando normativos novos entram no
// Radar. Sem as variáveis de ambiente, só avisa e segue em frente.
async function enviarDigest(novos, paraRadar) {
  if (paraRadar.length === 0) return
  const chaveResend = process.env.RESEND_API_KEY
  const destinatarios = process.env.DIGEST_PARA
  const webhookTeams = process.env.TEAMS_WEBHOOK_URL
  if (!(chaveResend && destinatarios) && !webhookTeams) {
    console.log('📭 Digest desativado (defina RESEND_API_KEY + DIGEST_PARA e/ou TEAMS_WEBHOOK_URL para receber alertas)')
    return
  }

  const assunto = `Radar Regulatório: ${paraRadar.length} normativo(s) novo(s) no Radar`
  const escapar = (texto) =>
    String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  if (chaveResend && destinatarios) {
    try {
      const html = [
        `<h2>🎯 ${paraRadar.length} normativo(s) novo(s) entraram no Radar</h2>`,
        '<ul>',
        ...paraRadar.map(
          (n) => `<li><a href="${escapar(n.url)}">${escapar(n.titulo)}</a> — temas: ${escapar((n.temas ?? []).join(', ')) || '—'}</li>`,
        ),
        '</ul>',
        `<p>No total, esta rodada gravou ${novos.length} novidade(s) no feed.</p>`,
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
                { type: 'TextBlock', size: 'Medium', weight: 'Bolder', text: `🎯 ${assunto}`, wrap: true },
                ...paraRadar.map((n) => ({
                  type: 'TextBlock',
                  text: `• [${n.titulo}](${n.url})`,
                  wrap: true,
                })),
                { type: 'TextBlock', isSubtle: true, text: `No total, esta rodada gravou ${novos.length} novidade(s) no feed.`, wrap: true },
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

async function conectarSupabase() {
  // No GitHub Actions os valores vêm dos Secrets; no seu PC,
  // do arquivo coletor/config.local.js (que o git ignora).
  let url = process.env.SUPABASE_URL
  let chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) {
    try {
      const local = await import('./config.local.js')
      url = url || local.SUPABASE_URL
      chave = chave || local.SUPABASE_SERVICE_ROLE_KEY
    } catch {
      /* arquivo local não existe — tudo bem, o erro abaixo explica */
    }
  }
  if (!url || !chave) {
    throw new Error(
      'faltam as credenciais do Supabase. Crie o arquivo coletor/config.local.js ' +
        '(copie do config.local.exemplo.js) ou defina as variáveis SUPABASE_URL e ' +
        'SUPABASE_SERVICE_ROLE_KEY. Para testar sem banco: npm run coletar:teste',
    )
  }
  return createClient(url, chave)
}

principal().catch((erro) => {
  console.error(`\n❌ Falha na coleta: ${erro.message}`)
  process.exit(1)
})
