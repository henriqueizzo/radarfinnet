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
import { coletarBCB } from './fontes/bcb.js'
import { coletarCoaf } from './fontes/coaf.js'
import { coletarFebraban } from './fontes/febraban.js'
import { coletarOpenFinance } from './fontes/openfinance.js'
import { coletarDOU } from './fontes/dou.js'
import { detectarTemas } from './temas.js'
import { enviarAviso } from './aviso.js'
import { conectarSupabase } from './supabase.js'

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

// Resumo por e-mail/Teams quando normativos novos entram no Radar
// (o envio em si fica em coletor/aviso.js, compartilhado com a vertical
// Split Payment & Reforma Tributária).
async function enviarDigest(novos, paraRadar) {
  if (paraRadar.length === 0) return
  await enviarAviso({
    assunto: `Radar Regulatório: ${paraRadar.length} normativo(s) novo(s) no Radar`,
    cabecalho: `🎯 ${paraRadar.length} normativo(s) novo(s) entraram no Radar`,
    itens: paraRadar.map((n) => ({
      titulo: n.titulo,
      url: n.url,
      detalhe: `temas: ${(n.temas ?? []).join(', ') || '—'}`,
    })),
    rodape: `No total, esta rodada gravou ${novos.length} novidade(s) no feed.`,
  })
}

principal().catch((erro) => {
  console.error(`\n❌ Falha na coleta: ${erro.message}`)
  process.exit(1)
})
