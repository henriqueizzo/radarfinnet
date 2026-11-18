// ============================================================
// 🧾 COLETOR SPLIT PAYMENT & REFORMA TRIBUTÁRIA
//
// Todo dia, para cada banco integrado à Finnet (coletor/tributario/bancos.js):
//   1. busca no Google News o que o PRÓPRIO banco publicou nos sites
//      oficiais dele sobre split payment / reforma tributária e as
//      documentações de layout (CNAB, manuais técnicos, padrões Febraban);
//   2. busca o que saiu na imprensa com o nome do banco NO TÍTULO;
//   3. classifica cada achado (assunto, sinais de ação, prioridade);
//   4. grava em tributario_publicacoes sem duplicar (a URL é única);
//   5. anota a saúde da rodada em coletas_execucoes;
//   6. avisa o time (e-mail/Teams) quando entra algo de prioridade Alta.
//
// Rodar na mão:      npm run coletar:tributario
// Testar sem banco:  npm run coletar:tributario:teste
// Automático:        GitHub Actions (.github/workflows/tributario.yml)
// ============================================================
import { BANCOS } from './tributario/bancos.js'
import {
  buscarGoogleNews,
  consultaLayout,
  consultaNome,
  consultaSite,
  ehDoBanco,
} from './tributario/googlenews.js'
import {
  ASSUNTO_LAYOUT,
  calcularPrioridade,
  detectarAssuntos,
  detectarSinais,
  statusInicial,
  tituloCitaBanco,
} from './tributario/analise.js'
import { enviarAviso } from './aviso.js'
import { conectarSupabase } from './supabase.js'

const MODO_TESTE = process.argv.includes('--teste')
const PAUSA_MS = 700 // educação com o Google News entre uma consulta e outra
const TAMANHO_DO_LOTE = 100
const NOME_FONTE = 'Split/Reforma (Google News)'

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Transforma o que veio do Google News em linha da tabela — ou null se
// não serve (sem assunto no título, ou imprensa que não cita o banco)
export function montarPublicacao(banco, item, { buscaPorSite }) {
  const doBanco = ehDoBanco(item.siteVeiculo, banco.dominios)
  if (buscaPorSite && !doBanco) return null // o filtro site: do Google às vezes vaza
  if (!doBanco && !banco.geral && !tituloCitaBanco(item.titulo, banco)) return null
  // Layout só conta no site do próprio banco (na imprensa é nota fiscal)
  const assuntos = detectarAssuntos(item.titulo).filter((a) => doBanco || a !== ASSUNTO_LAYOUT)
  if (assuntos.length === 0) return null
  if (banco.geral && !assuntos.includes('Split Payment')) return null
  const origem = doBanco ? 'Site do banco' : 'Imprensa'
  const sinais = detectarSinais(item.titulo)
  return {
    banco: banco.nome,
    titulo: item.titulo,
    url: item.url,
    veiculo: item.veiculo,
    origem,
    assuntos,
    sinais,
    prioridade: calcularPrioridade({ assuntos, sinais, origem }),
    status: statusInicial(item.data_publicacao),
    data_publicacao: item.data_publicacao,
  }
}

async function coletarBanco(banco) {
  const achados = []
  const falhas = []
  const consultas = [
    ...banco.dominios.map((d) => [consultaSite(d), true]),
    ...banco.dominios.map((d) => [consultaLayout(d), true]),
    [banco.consulta ?? consultaNome(banco.busca), false],
  ]
  for (const [consulta, buscaPorSite] of consultas) {
    try {
      const itens = await buscarGoogleNews(consulta)
      for (const item of itens) {
        const publicacao = montarPublicacao(banco, item, { buscaPorSite })
        if (publicacao) achados.push(publicacao)
      }
    } catch (erro) {
      falhas.push(`${consulta}: ${erro.message}`)
    }
    await esperar(PAUSA_MS)
  }
  return { achados, falhas, consultas: consultas.length }
}

async function principal() {
  console.log(`🧾 Split Payment & Reforma Tributária — coleta iniciada${MODO_TESTE ? ' (MODO TESTE, nada será gravado)' : ''}\n`)
  const inicio = Date.now()

  const porUrl = new Map()
  let totalConsultas = 0
  const falhas = []
  for (const banco of BANCOS) {
    const r = await coletarBanco(banco)
    totalConsultas += r.consultas
    falhas.push(...r.falhas)
    let novosDoBanco = 0
    for (const p of r.achados) {
      // a mesma matéria pode vir pelas duas buscas — fica a primeira,
      // mas "Site do banco" ganha de "Imprensa"
      const existente = porUrl.get(p.url)
      if (!existente || (existente.origem === 'Imprensa' && p.origem === 'Site do banco')) {
        if (!existente) novosDoBanco++
        porUrl.set(p.url, p)
      }
    }
    const aviso = r.falhas.length > 0 ? `  ⚠️ ${r.falhas.length} consulta(s) falharam` : ''
    console.log(`${novosDoBanco > 0 ? '✅' : '·'} ${banco.nome}: ${novosDoBanco}${aviso}`)
  }
  const itens = [...porUrl.values()]
  console.log(`\n📦 ${itens.length} publicações únicas em ${totalConsultas} consultas`)

  // Muitas consultas falhando = algo errado de verdade (bloqueio, rede)
  const erroGeral =
    falhas.length > totalConsultas * 0.2
      ? `${falhas.length} de ${totalConsultas} consultas falharam (ex.: ${falhas[0]})`
      : null
  if (falhas.length > 0) console.warn(`⚠️ ${falhas.length} consulta(s) com falha; primeira: ${falhas[0]}`)

  if (MODO_TESTE) {
    const ordem = { Alta: 0, Média: 1, Baixa: 2 }
    const amostra = [...itens].sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade]).slice(0, 15)
    for (const p of amostra) {
      console.log(`\n[${p.prioridade} · ${p.status} · ${p.origem}] ${p.banco}: ${p.titulo}`)
      console.log(`   ${p.data_publicacao?.slice(0, 10) ?? 'sem data'} | ${p.assuntos.join(', ')} | sinais: ${p.sinais.join(', ') || '—'}`)
    }
    const contar = (campo, valor) => itens.filter((i) => i[campo] === valor).length
    console.log(`\n🏷️  Alta: ${contar('prioridade', 'Alta')} · Média: ${contar('prioridade', 'Média')} · Baixa: ${contar('prioridade', 'Baixa')}`)
    console.log(`🆕 Novos (até 15 dias): ${contar('status', 'Novo')} · Histórico: ${contar('status', 'Histórico')}`)
    const layouts = itens.filter((i) => i.assuntos.includes(ASSUNTO_LAYOUT))
    console.log(`📐 Documentações de layout: ${layouts.length} em ${new Set(layouts.map((i) => i.banco)).size} bancos`)
    console.log(`🏦 Bancos com publicação: ${new Set(itens.map((i) => i.banco)).size} de ${BANCOS.length} (inclui Febraban e Mercado)`)
    console.log('Modo teste: nada foi gravado.')
    return
  }

  const supabase = await conectarSupabase()
  const novos = []
  let falhaAoGravar = false
  for (let i = 0; i < itens.length; i += TAMANHO_DO_LOTE) {
    const lote = itens.slice(i, i + TAMANHO_DO_LOTE)
    const { data, error } = await supabase
      .from('tributario_publicacoes')
      .upsert(lote, { onConflict: 'url', ignoreDuplicates: true })
      .select('banco, titulo, url, prioridade, status, assuntos')
    if (error) {
      falhaAoGravar = true
      console.error(`❌ Supabase (tributario_publicacoes): ${error.message}`)
      if (/tributario_publicacoes/.test(error.message)) {
        console.error('   → aplique supabase/migracao-2026-11-12.sql no SQL Editor do Supabase')
        break
      }
      continue
    }
    novos.push(...data)
  }
  console.log(`🆕 ${novos.length} publicações novas gravadas`)

  try {
    const { error } = await supabase.from('coletas_execucoes').insert({
      fonte: NOME_FONTE,
      iniciada_em: new Date(inicio).toISOString(),
      duracao_ms: Date.now() - inicio,
      itens: itens.length,
      erro: erroGeral,
    })
    if (error) throw new Error(error.message)
  } catch (erro) {
    console.log(`ℹ️ Não registrei a saúde da coleta (${erro.message})`)
  }

  // Alerta só do que é Alta e recente — o histórico não dispara aviso
  const urgentes = novos.filter((n) => n.prioridade === 'Alta' && n.status === 'Novo')
  if (urgentes.length > 0) {
    await enviarAviso({
      assunto: `Split Payment & Reforma: ${urgentes.length} publicação(ões) de prioridade Alta`,
      cabecalho: `🧾 ${urgentes.length} publicação(ões) de bancos parceiros pedem atenção`,
      itens: urgentes.map((n) => ({ titulo: `${n.banco}: ${n.titulo}`, url: n.url, detalhe: n.assuntos.join(', ') })),
      rodape: `No total, entraram ${novos.length} publicação(ões) nesta rodada. Veja a aba Split & Reforma do Radar.`,
    })
  }

  if (erroGeral || falhaAoGravar) {
    console.error(`\n⚠️ Coleta terminou com problemas${erroGeral ? ` (${erroGeral})` : ''}. O que deu certo foi gravado.`)
    process.exit(1)
  }
  console.log('\n✅ Coleta concluída.')
}

// Só roda quando chamado direto (os testes importam montarPublicacao)
if (process.argv[1]?.replace(/\\/g, '/').endsWith('coletor/coletar-tributario.js')) {
  principal().catch((erro) => {
    console.error(`\n❌ Falha na coleta: ${erro.message}`)
    process.exit(1)
  })
}
