// Camada de dados — TODA leitura do feed e TODA gravação feita pelo site
// passam por aqui.
// Cada função devolve { ok: true, ...extras } ou { ok: false, erro: 'mensagem' }.
//
// MODO DEMONSTRAÇÃO (demo = true): nada vai ao Supabase — as leituras filtram
// os dados de exemplo em memória e as gravações devolvem um resultado simulado
// (a tela atualiza só localmente e some ao recarregar).
// Assim as telas têm UM caminho só, sem "if (demo)" espalhado.
import { supabase } from './supabaseClient.js'
import { registrarAtividade } from './atividade.js'
import { NOTICIAS_DEMO, RADAR_DEMO } from './demo.js'
import { semAcentos } from './util.js'
import { prioridadeDaCategoria } from './catalogos.js'

const AJUDA_FUNCAO =
  'Não consegui falar com a função "admin-usuarios" do Supabase. ' +
  'Publique-a seguindo o passo a passo do docs/COMO-CONFIGURAR.md ' +
  '(Painel do Supabase → Edge Functions → Deploy).'

// O banco exige usuario_email preenchido em atividades e radar_eventos.
// Se o e-mail não veio da tela, busca o da sessão logada.
async function emailGarantido(usuario) {
  if (usuario) return usuario
  const { data } = await supabase.auth.getUser()
  return data?.user?.email ?? ''
}

// Guarda no histórico do card quem fez a mudança de status
async function gravarEvento({ radarId, deStatus, paraStatus, usuario }) {
  const { error } = await supabase.from('radar_eventos').insert({
    radar_id: radarId,
    de_status: deStatus,
    para_status: paraStatus,
    usuario_email: await emailGarantido(usuario),
  })
  if (error) console.warn(`histórico do radar falhou: ${error.message}`)
}

/* ---------- Feed: buscar notícias (filtros + paginação no servidor) ---------- */

export const TAMANHO_PAGINA = 50

// Estado "limpo" dos filtros do feed — compartilhado entre App.jsx e Feed.jsx
export const FILTROS_INICIAIS = {
  busca: '', // texto no título ou resumo
  fonte: '',
  categoria: '',
  tema: '',
  periodo: '', // '' = qualquer data | '7d' | '30d' | 'personalizado'
  dataInicio: '', // usados só quando periodo === 'personalizado' (AAAA-MM-DD)
  dataFim: '',
  arquivadas: false, // true = mostra também as notícias arquivadas pelo time
  ordem: '', // '' = mais recentes primeiro | 'prioridade' = 01 Normativos → 02 Comunicados → 03 resto
}

/* ---------- Curadoria: as colunas novas podem ainda não existir ---------- */
// As colunas descartada e temas_manuais só existem depois de aplicar a
// migração supabase/migracao-2026-08-16.sql. Tudo aqui TOLERA a ausência:
// sem as colunas, o feed não filtra por elas e as gravações explicam o que fazer.

const AJUDA_MIGRACAO =
  'O banco ainda não tem as colunas de curadoria (descartada/temas_manuais). ' +
  'Aplique o arquivo supabase/migracao-2026-08-16.sql no SQL Editor do Supabase e tente de novo.'

// O RLS pode recusar um UPDATE em silêncio (sucesso com 0 linhas alteradas);
// o .select('id') depois do update deixa isso visível para avisarmos.
const AJUDA_PERMISSAO =
  'O banco não deixou salvar (nenhuma linha foi alterada). ' +
  'Aplique a versão atual do supabase/migracao-2026-08-16.sql — ela inclui ' +
  'a permissão de curadoria — e tente de novo.'

// O erro veio porque a coluna não existe no banco?
function faltaColunaCuradoria(error) {
  return (
    error?.code === '42703' || // Postgres: coluna inexistente
    error?.code === 'PGRST204' || // PostgREST: coluna fora do schema cache
    /column|coluna|schema cache/i.test(error?.message ?? '')
  )
}

// Consulta de teste feita UMA vez por sessão: a coluna descartada existe?
// Guardamos a promessa para todas as buscas esperarem a MESMA resposta.
let deteccaoCuradoria = null
function curadoriaDisponivel() {
  if (!deteccaoCuradoria) {
    deteccaoCuradoria = supabase
      .from('noticias')
      .select('descartada')
      .limit(1)
      .then(({ error }) => !error)
      .catch(() => false)
  }
  return deteccaoCuradoria
}

// A coluna prioridade (01 Normativo · 02 Comunicado · 03 resto) nasce na
// migração 2026-08-24 — mesma ideia da curadoria: detecta uma vez só.
const AJUDA_ORDEM =
  'Para ordenar por prioridade, aplique o arquivo supabase/migracao-2026-08-24.sql ' +
  'no SQL Editor do Supabase. Por enquanto o feed segue por data.'

let deteccaoPrioridade = null
function prioridadeDisponivel() {
  if (!deteccaoPrioridade) {
    deteccaoPrioridade = supabase
      .from('noticias')
      .select('prioridade')
      .limit(1)
      .then(({ error }) => !error)
      .catch(() => false)
  }
  return deteccaoPrioridade
}

// Converte o filtro de período em datas concretas (null = sem limite)
function intervaloDatas({ periodo, dataInicio, dataFim }) {
  const diasAtras = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
  if (periodo === '7d') return { inicio: diasAtras(7), fim: null }
  if (periodo === '30d') return { inicio: diasAtras(30), fim: null }
  if (periodo === 'personalizado') {
    return {
      inicio: dataInicio ? new Date(`${dataInicio}T00:00:00`).toISOString() : null,
      fim: dataFim ? new Date(`${dataFim}T23:59:59.999`).toISOString() : null,
    }
  }
  return { inicio: null, fim: null }
}

// Modo demonstração: os MESMOS filtros do servidor, aplicados em memória
// (a busca por texto aqui ignora acentos; no servidor é o ilike do Postgres)
function filtrarNoticiasDemo(noticias, filtros) {
  const { busca, fonte, categoria, tema } = filtros
  const { inicio, fim } = intervaloDatas(filtros)
  return noticias
    .filter((n) => {
      if (!filtros.arquivadas && n.descartada) return false
      if (fonte && n.fonte !== fonte) return false
      if (categoria && n.categoria !== categoria) return false
      if (tema && !(n.temas ?? []).includes(tema)) return false
      if (busca && !semAcentos(`${n.titulo} ${n.resumo}`).includes(semAcentos(busca))) return false
      if (inicio && !(n.data_publicacao >= inicio)) return false
      if (fim && !(n.data_publicacao <= fim)) return false
      return true
    })
    .sort((a, b) => {
      if (filtros.ordem === 'prioridade') {
        const diferenca = prioridadeDaCategoria(a.categoria) - prioridadeDaCategoria(b.categoria)
        if (diferenca !== 0) return diferenca
      }
      return (b.data_publicacao ?? '').localeCompare(a.data_publicacao ?? '')
    })
}

// Devolve UMA página de notícias já filtrada + o total geral do filtro.
// pagina começa em 0; cada página tem TAMANHO_PAGINA itens.
export async function buscarNoticias({ demo, filtros = FILTROS_INICIAIS, pagina = 0 }) {
  const de = pagina * TAMANHO_PAGINA
  if (demo) {
    const filtradas = filtrarNoticiasDemo(NOTICIAS_DEMO, filtros)
    return {
      ok: true,
      noticias: filtradas.slice(de, de + TAMANHO_PAGINA),
      total: filtradas.length,
      ordemAplicada: filtros.ordem ?? '',
      avisoOrdem: '',
    }
  }
  let consulta = supabase.from('noticias').select('*', { count: 'exact' })
  // Arquivadas fora do feed padrão — SÓ se a coluna existir no banco
  // (sem a migração, filtrar por ela quebraria TODAS as buscas)
  if (!filtros.arquivadas && (await curadoriaDisponivel())) {
    consulta = consulta.eq('descartada', false)
  }
  if (filtros.fonte) consulta = consulta.eq('fonte', filtros.fonte)
  if (filtros.categoria) consulta = consulta.eq('categoria', filtros.categoria)
  if (filtros.tema) consulta = consulta.contains('temas', [filtros.tema])
  // vírgula e parênteses quebrariam a sintaxe do .or() do Supabase — viram espaço
  const texto = (filtros.busca ?? '').replace(/[,()]/g, ' ').trim()
  if (texto) consulta = consulta.or(`titulo.ilike.%${texto}%,resumo.ilike.%${texto}%`)
  const { inicio, fim } = intervaloDatas(filtros)
  if (inicio) consulta = consulta.gte('data_publicacao', inicio)
  if (fim) consulta = consulta.lte('data_publicacao', fim)
  // Prioridade primeiro (se pedida E a coluna existir no banco); a data
  // desempata — e continua sendo a ordem padrão quando ninguém pede prioridade
  const porPrioridade = filtros.ordem === 'prioridade' && (await prioridadeDisponivel())
  if (porPrioridade) consulta = consulta.order('prioridade', { ascending: true })
  const { data, error, count } = await consulta
    .order('data_publicacao', { ascending: false, nullsFirst: false })
    .range(de, de + TAMANHO_PAGINA - 1)
  if (error) return { ok: false, erro: error.message }
  return {
    ok: true,
    noticias: data ?? [],
    total: count ?? (data?.length ?? 0),
    ordemAplicada: porPrioridade ? 'prioridade' : '',
    avisoOrdem: filtros.ordem === 'prioridade' && !porPrioridade ? AJUDA_ORDEM : '',
  }
}

/* ---------- Exportar CSV: buscar TODAS as páginas do filtro ---------- */
// A exportação leva tudo que casa com o filtro (não só a página na tela):
// busca as páginas em sequência até acabar ou bater no limite de segurança.

export const LIMITE_EXPORTACAO = 2000

export async function buscarTodasNoticias({ demo, filtros = FILTROS_INICIAIS, limite = LIMITE_EXPORTACAO }) {
  const todas = []
  for (let pagina = 0; todas.length < limite; pagina++) {
    const r = await buscarNoticias({ demo, filtros, pagina })
    if (!r.ok) return r
    todas.push(...r.noticias)
    if (todas.length >= r.total || r.noticias.length < TAMANHO_PAGINA) break
  }
  return { ok: true, noticias: todas.slice(0, limite) }
}

/* ---------- Curadoria: arquivar/restaurar e temas manuais ---------- */

// descartada=true tira a notícia do feed padrão (dá para rever com o
// filtro "Mostrar arquivadas" e restaurar quando quiser).
export async function arquivarNoticia({ demo, noticia, arquivada, usuario }) {
  if (demo) {
    noticia.descartada = arquivada // nos dados de exemplo, muda só em memória
    return { ok: true }
  }
  try {
    const { data, error } = await supabase
      .from('noticias')
      .update({ descartada: arquivada })
      .eq('id', noticia.id)
      .select('id')
    if (error) {
      if (faltaColunaCuradoria(error)) return { ok: false, erro: AJUDA_MIGRACAO }
      return { ok: false, erro: `Não consegui ${arquivada ? 'arquivar' : 'restaurar'}: ${error.message}` }
    }
    if (!data || data.length === 0) return { ok: false, erro: AJUDA_PERMISSAO }
  } catch (e) {
    return { ok: false, erro: `Não consegui ${arquivada ? 'arquivar' : 'restaurar'}: ${e.message}` }
  }
  registrarAtividade({
    usuario,
    tipo: arquivada ? 'arquivar_noticia' : 'restaurar_noticia',
    detalhe: noticia.titulo,
    noticiaId: noticia.id,
  })
  return { ok: true }
}

// Temas adicionados à mão pelo time — complementam os automáticos do coletor
export async function salvarTemasManuais({ demo, noticia, temas, usuario }) {
  if (demo) {
    noticia.temas_manuais = temas // nos dados de exemplo, muda só em memória
    return { ok: true }
  }
  try {
    const { data, error } = await supabase
      .from('noticias')
      .update({ temas_manuais: temas })
      .eq('id', noticia.id)
      .select('id')
    if (error) {
      if (faltaColunaCuradoria(error)) return { ok: false, erro: AJUDA_MIGRACAO }
      return { ok: false, erro: `Não consegui salvar os temas: ${error.message}` }
    }
    if (!data || data.length === 0) return { ok: false, erro: AJUDA_PERMISSAO }
  } catch (e) {
    return { ok: false, erro: `Não consegui salvar os temas: ${e.message}` }
  }
  registrarAtividade({ usuario, tipo: 'editar_temas', detalhe: noticia.titulo, noticiaId: noticia.id })
  return { ok: true }
}

/* ---------- Cockpit: indicadores contados no servidor ---------- */
// Contagens próprias (count exato, sem baixar linhas) para os indicadores
// não dependerem do recorte de notícias carregado na tela.

export async function buscarIndicadores({ demo }) {
  const iso7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const iso30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  if (demo) {
    return {
      ok: true,
      novidades7d: NOTICIAS_DEMO.filter((n) => n.data_publicacao >= iso7dias).length,
      normativos30d: NOTICIAS_DEMO.filter(
        (n) => n.categoria === 'Normativo' && n.data_publicacao >= iso30dias,
      ).length,
      ultimaColeta: NOTICIAS_DEMO.reduce((maior, n) => (n.criado_em > maior ? n.criado_em : maior), ''),
    }
  }
  const [novidades, normativos, coleta] = await Promise.all([
    supabase
      .from('noticias')
      .select('*', { count: 'exact', head: true })
      .gte('data_publicacao', iso7dias),
    supabase
      .from('noticias')
      .select('*', { count: 'exact', head: true })
      .eq('categoria', 'Normativo')
      .gte('data_publicacao', iso30dias),
    supabase
      .from('noticias')
      .select('criado_em')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const erro = novidades.error ?? normativos.error ?? coleta.error
  if (erro) return { ok: false, erro: erro.message }
  return {
    ok: true,
    novidades7d: novidades.count ?? 0,
    normativos30d: normativos.count ?? 0,
    ultimaColeta: coleta.data?.criado_em ?? '',
  }
}

/* ---------- Radar: carregar o quadro ---------- */

export async function buscarRadar({ demo }) {
  if (demo) return { ok: true, itens: RADAR_DEMO }
  const { data, error } = await supabase
    .from('radar_itens')
    .select('*, noticia:noticias(*)')
    .order('criado_em', { ascending: false })
  if (error) return { ok: false, erro: error.message }
  return { ok: true, itens: data ?? [] }
}

/* ---------- Feed: enviar notícia ao Radar ---------- */

export async function enviarNoticiaAoRadar({ demo, noticia, usuario }) {
  if (demo) {
    // devolve o card simulado pronto para entrar na tela
    const agora = new Date().toISOString()
    return {
      ok: true,
      itemDemo: {
        id: `demo-envio-${noticia.id}`,
        noticia_id: noticia.id,
        status: 'Encontrado',
        responsavel: '',
        observacoes: '',
        criado_em: agora,
        atualizado_em: agora,
        noticia,
      },
    }
  }
  const { data, error } = await supabase
    .from('radar_itens')
    .insert({ noticia_id: noticia.id })
    .select('id')
    .single()
  if (error) return { ok: false, erro: error.message }
  await gravarEvento({ radarId: data.id, deStatus: null, paraStatus: 'Encontrado', usuario })
  registrarAtividade({ usuario, tipo: 'enviar_radar', detalhe: noticia.titulo, noticiaId: noticia.id })
  return { ok: true }
}

/* ---------- Radar: mover, salvar e remover cards ---------- */

export async function moverStatusCard({ demo, item, novoStatus, usuario }) {
  if (demo) return { ok: true }
  const { error } = await supabase
    .from('radar_itens')
    .update({ status: novoStatus })
    .eq('id', item.id)
  if (error) return { ok: false, erro: error.message }
  await gravarEvento({ radarId: item.id, deStatus: item.status, paraStatus: novoStatus, usuario })
  registrarAtividade({
    usuario,
    tipo: 'mover_status',
    detalhe: `${item.status} → ${novoStatus} — ${item.noticia?.titulo ?? ''}`,
    noticiaId: item.noticia_id,
  })
  return { ok: true }
}

export async function salvarCard({ demo, item, responsavel, observacoes, usuario }) {
  if (demo) return { ok: true }
  const { error } = await supabase
    .from('radar_itens')
    .update({ responsavel, observacoes })
    .eq('id', item.id)
  if (error) return { ok: false, erro: error.message }
  registrarAtividade({
    usuario,
    tipo: 'editar_card',
    detalhe: item.noticia?.titulo ?? '',
    noticiaId: item.noticia_id,
  })
  return { ok: true }
}

export async function removerCard({ demo, item, usuario }) {
  if (demo) return { ok: true }
  const { error } = await supabase.from('radar_itens').delete().eq('id', item.id)
  if (error) return { ok: false, erro: error.message }
  registrarAtividade({
    usuario,
    tipo: 'remover_card',
    detalhe: item.noticia?.titulo ?? '',
    noticiaId: item.noticia_id,
  })
  return { ok: true }
}

export async function buscarHistorico({ demo, radarId }) {
  if (demo) return { ok: true, eventos: [] } // no demo não há histórico gravado
  const { data, error } = await supabase
    .from('radar_eventos')
    .select('*')
    .eq('radar_id', radarId)
    .order('quando', { ascending: false })
  if (error) return { ok: false, erro: error.message }
  return { ok: true, eventos: data ?? [] }
}

/* ---------- Aba Usuários (só administradores) ---------- */
// As ações que exigem a chave secreta (criar, resetar senha, desativar)
// rodam na Edge Function "admin-usuarios" dentro do Supabase.

async function chamarAdmin(corpo) {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: corpo })
  if (error) return { ok: false, erro: AJUDA_FUNCAO }
  if (!data) return { ok: false, erro: 'Resposta vazia da função.' }
  if (data.erro) return { ok: false, erro: data.erro }
  return { ok: true }
}

export async function listarUsuarios({ demo }) {
  if (demo) return { ok: true, dados: null } // a tela já abre com os perfis de exemplo
  const { data, error } = await supabase.from('perfis').select('*').order('criado_em')
  if (error) return { ok: false, erro: error.message }
  return { ok: true, dados: data }
}

export async function criarUsuario({ demo, nome, email, senha, is_admin }) {
  if (demo) {
    return {
      ok: true,
      usuarioDemo: {
        id: `demo-u-${Date.now()}`,
        nome,
        email,
        is_admin,
        ativo: true,
        criado_em: new Date().toISOString(),
      },
    }
  }
  return chamarAdmin({ acao: 'criar', nome, email, senha, is_admin })
}

export async function definirUsuarioAtivo({ demo, id, ativo }) {
  if (demo) return { ok: true }
  return chamarAdmin({ acao: 'definir_ativo', id, ativo })
}

export async function definirUsuarioAdmin({ demo, id, is_admin }) {
  if (demo) return { ok: true }
  return chamarAdmin({ acao: 'definir_admin', id, is_admin })
}

export async function resetarSenhaUsuario({ demo, id, senha }) {
  if (demo) return { ok: true }
  return chamarAdmin({ acao: 'resetar_senha', id, senha })
}
