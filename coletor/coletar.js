// ============================================================
// 🤖 COLETOR DO RADAR REGULATÓRIO
//
// O que ele faz, em ordem:
//   1. busca as novidades em cada fonte (BCB, Coaf, Febraban,
//      Open Finance e DOU);
//   2. etiqueta cada item com os temas Finnet (coletor/temas.js);
//   3. grava tudo no Supabase sem duplicar (a URL é única);
//   4. normativos com tema Finnet viram card "Encontrado" no Radar.
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

const FONTES = [
  ['Banco Central', coletarBCB],
  ['Coaf (notícias)', coletarCoaf],
  ['Febraban', coletarFebraban],
  ['Open Finance', coletarOpenFinance],
  ['Coaf via DOU', coletarDOU],
]

async function principal() {
  console.log(`📡 Radar Regulatório — coleta iniciada${MODO_TESTE ? ' (MODO TESTE, nada será gravado)' : ''}\n`)

  // 1 + 2) coleta cada fonte e etiqueta os temas
  const coletados = []
  for (const [nome, coletar] of FONTES) {
    try {
      const itens = await coletar()
      for (const item of itens) item.temas = detectarTemas(`${item.titulo} ${item.resumo}`)
      console.log(`✅ ${nome}: ${itens.length} itens`)
      coletados.push(...itens)
    } catch (erro) {
      // uma fonte fora do ar não derruba a coleta inteira
      console.error(`❌ ${nome}: ${erro.message}`)
    }
  }

  // remove repetidos dentro da própria rodada (mesma URL)
  const porUrl = new Map()
  for (const item of coletados) {
    if (item.url && !porUrl.has(item.url)) porUrl.set(item.url, item)
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

  // 3) grava no banco — URLs que já existem são ignoradas em silêncio
  const supabase = await conectarSupabase()
  const { data: novos, error } = await supabase
    .from('noticias')
    .upsert(itens, { onConflict: 'url', ignoreDuplicates: true })
    .select('id, categoria, temas, titulo')
  if (error) throw new Error(`Supabase (noticias): ${error.message}`)
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
    if (erroRadar) throw new Error(`Supabase (radar): ${erroRadar.message}`)
    console.log(`🎯 ${paraRadar.length} normativos enviados ao Radar:`)
    for (const n of paraRadar) console.log(`   • ${n.titulo}`)
  }

  console.log('\n✅ Coleta concluída.')
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
