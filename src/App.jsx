import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, configurado } from './lib/supabaseClient.js'
import { iniciais } from './lib/util.js'
import { RADAR_DEMO } from './lib/demo.js'
import {
  buscarNoticias,
  buscarIndicadores,
  buscarRadar,
  FILTROS_INICIAIS,
  TAMANHO_PAGINA,
} from './lib/api.js'
import { lerEstadoDaUrl, gravarEstadoNaUrl } from './lib/urlEstado.js'
import { useAvisos } from './componentes/Avisos.jsx'
import TelaLogin from './TelaLogin.jsx'
import Feed from './abas/Feed.jsx'
import Radar from './abas/Radar.jsx'
import Usuarios from './abas/Usuarios.jsx'
import Atividade from './abas/Atividade.jsx'

// Sem o Supabase configurado, o site abre em MODO DEMONSTRAÇÃO:
// dados de exemplo, sem login e sem gravar nada.
const DEMO = !configurado

const ABAS = [
  ['feed', '📰 Feed de novidades'],
  ['radar', '🎯 Radar de mudanças'],
]

// Deep-link: se o endereço veio com ?aba=…&fonte=…&card=…, a tela abre
// já naquele estado (lido UMA vez, na abertura do site)
const ESTADO_URL = lerEstadoDaUrl()

export default function App() {
  const { toast } = useAvisos()
  const [sessao, setSessao] = useState(null)
  const [autenticacaoPronta, setAutenticacaoPronta] = useState(false)
  const [aba, setAba] = useState(ESTADO_URL.aba ?? 'feed')
  // Feed: as notícias chegam do servidor já filtradas, em páginas de 50
  const [noticias, setNoticias] = useState(null) // null = carregando
  const [totalNoticias, setTotalNoticias] = useState(0)
  // Ordem que o servidor realmente aplicou + aviso caso a migração falte
  const [ordemAplicada, setOrdemAplicada] = useState('')
  const [avisoOrdem, setAvisoOrdem] = useState('')
  const [filtros, setFiltros] = useState(ESTADO_URL.filtros ?? FILTROS_INICIAIS)
  // Card aberto do radar fica aqui (e não dentro do Radar.jsx) para
  // entrar no link compartilhável junto com a aba e os filtros
  const [cardAberto, setCardAberto] = useState(ESTADO_URL.cardAberto)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [indicadores, setIndicadores] = useState(null) // números do cockpit
  const [atualizando, setAtualizando] = useState(false)
  const [radar, setRadar] = useState(DEMO ? RADAR_DEMO : null)
  const [erro, setErro] = useState('')
  const idBusca = useRef(0) // para descartar respostas que cheguem atrasadas
  const ultimaAtualizacao = useRef(Date.now()) // controla o refetch ao voltar à janela
  const [erroPerfil, setErroPerfil] = useState('')
  // Perfil do usuário logado (nome + é admin?) — no demo, todos são admin
  const [perfil, setPerfil] = useState(
    DEMO ? { nome: 'Demonstração', is_admin: true, ativo: true } : null,
  )

  // Observa o login/logout
  useEffect(() => {
    if (!configurado) return
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setAutenticacaoPronta(true)
    })
    const { data: ouvinte } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao)
    })
    return () => ouvinte.subscription.unsubscribe()
  }, [])

  // Carrega UMA página do feed (filtros aplicados no servidor; no demo, em memória).
  // pagina 0 substitui a lista; páginas seguintes são acrescentadas no fim.
  const carregarFeed = useCallback(async (filtrosAtuais, pagina = 0) => {
    const id = ++idBusca.current
    const r = await buscarNoticias({ demo: DEMO, filtros: filtrosAtuais, pagina })
    if (id !== idBusca.current) return // já existe uma busca mais nova — ignora esta
    if (!r.ok) {
      setErro(`Não consegui carregar o feed: ${r.erro}`)
      return
    }
    setErro('')
    setNoticias((atuais) => (pagina === 0 ? r.noticias : [...(atuais ?? []), ...r.noticias]))
    setTotalNoticias(r.total)
    setOrdemAplicada(r.ordemAplicada ?? '')
    setAvisoOrdem(r.avisoOrdem ?? '')
  }, [])

  // Sempre que os filtros mudam, recomeça da primeira página
  useEffect(() => {
    if (!DEMO && !sessao) return
    carregarFeed(filtros, 0)
  }, [filtros, sessao, carregarFeed])

  // Botão "Carregar mais": busca a próxima página de 50
  const carregarMais = useCallback(async () => {
    if (!noticias) return
    setCarregandoMais(true)
    await carregarFeed(filtros, Math.floor(noticias.length / TAMANHO_PAGINA))
    setCarregandoMais(false)
  }, [noticias, filtros, carregarFeed])

  // Quadro do radar (no demo ele só muda localmente — nada a recarregar)
  const carregarRadar = useCallback(async () => {
    if (DEMO) return
    const r = await buscarRadar({ demo: false })
    if (!r.ok) {
      setErro(`Não consegui carregar o radar: ${r.erro}`)
      return
    }
    setRadar(r.itens)
  }, [])

  // Números do cockpit — contados no servidor, independentes da página carregada
  const carregarIndicadores = useCallback(async () => {
    const r = await buscarIndicadores({ demo: DEMO })
    if (r.ok) setIndicadores(r)
  }, [])

  useEffect(() => {
    if (!DEMO && !sessao) return
    carregarRadar()
    carregarIndicadores()
  }, [sessao, carregarRadar, carregarIndicadores])

  // Botão "Atualizar" e refetch automático: recarrega tudo de uma vez
  const atualizarTudo = useCallback(async () => {
    ultimaAtualizacao.current = Date.now()
    setAtualizando(true)
    await Promise.all([carregarFeed(filtros, 0), carregarRadar(), carregarIndicadores()])
    setAtualizando(false)
  }, [filtros, carregarFeed, carregarRadar, carregarIndicadores])

  // Ao voltar para a janela (foco ou aba visível), atualiza sozinho —
  // no máximo 1 vez por minuto, para não martelar o servidor
  useEffect(() => {
    if (!DEMO && !sessao) return
    const aoVoltar = () => {
      if (document.visibilityState === 'hidden') return
      if (Date.now() - ultimaAtualizacao.current < 60 * 1000) return
      atualizarTudo()
    }
    window.addEventListener('focus', aoVoltar)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.removeEventListener('focus', aoVoltar)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [sessao, atualizarTudo])

  // Espelha aba, filtros e card aberto na URL (replaceState troca o endereço
  // sem recarregar): copiar o link da barra = compartilhar esta visão no Teams
  useEffect(() => {
    gravarEstadoNaUrl({ aba, filtros, cardAberto })
  }, [aba, filtros, cardAberto])

  // Busca o perfil (nome, admin, ativo); acesso desativado é barrado aqui também.
  // Se a busca falhar, avisa e oferece "Tentar de novo" (em vez de assumir
  // silenciosamente que a pessoa não é admin).
  const carregarPerfil = useCallback(async () => {
    if (DEMO || !sessao) return
    setErroPerfil('')
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', sessao.user.id)
      .maybeSingle()
    if (error) {
      setErroPerfil(`Não consegui carregar seu perfil: ${error.message}`)
      return
    }
    if (data && data.ativo === false) {
      toast('Seu acesso foi desativado. Fale com um administrador.', 'erro')
      supabase.auth.signOut()
      return
    }
    setPerfil(data ?? { nome: '', is_admin: false, ativo: true })
  }, [sessao, toast])

  useEffect(() => {
    carregarPerfil()
  }, [carregarPerfil])

  if (!DEMO && !autenticacaoPronta) {
    return (
      <div className="app">
        <p className="pendente">Carregando…</p>
      </div>
    )
  }
  if (!DEMO && !sessao) return <TelaLogin />

  const email = DEMO ? 'henrique@finnet.com.br' : (sessao.user?.email ?? '')
  const nomeExibido = perfil?.nome || email
  const encontrados = (radar ?? []).filter((i) => i.status === 'Encontrado').length

  // Abas de administração só aparecem para admins (como no LicitaFinnet)
  const abas = perfil?.is_admin
    ? [...ABAS, ['usuarios', '👥 Usuários'], ['atividade', '📈 Atividade']]
    : ABAS

  // Um link pode chegar apontando para uma aba que esta pessoa não vê
  // (ex.: ?aba=usuarios sem ser admin) — nesse caso, mostra o feed
  const abaAtiva = abas.some(([id]) => id === aba) ? aba : 'feed'

  return (
    <div className="app">
      <header>
        <div className="marca">
          <span className="logo-chip">
            <img src="./finnet-logo.png" alt="Finnet" className="logo" />
          </span>
          <span className="marca-sub">Radar Regulatório</span>
        </div>
        <nav aria-label="Abas do sistema">
          {abas.map(([id, rotulo]) => (
            <button key={id} className={abaAtiva === id ? 'ativo' : ''} onClick={() => setAba(id)}>
              {rotulo}
              {id === 'radar' && encontrados > 0 ? ` (${encontrados})` : ''}
            </button>
          ))}
        </nav>
        <div className="usuario-area">
          <button
            className="usuario-btn"
            onClick={atualizarTudo}
            disabled={atualizando}
            title="Buscar novidades agora (também atualiza sozinho ao voltar para a janela)"
          >
            {atualizando ? '⏳ Atualizando…' : '🔄 Atualizar'}
          </button>
          <span className="resp-chip" title={email}>
            {iniciais(nomeExibido)}
          </span>
          <span className="usuario-nome" title={email}>
            {nomeExibido}
          </span>
          {!DEMO && (
            <button className="usuario-btn" onClick={() => supabase.auth.signOut()}>
              Sair
            </button>
          )}
        </div>
      </header>

      {DEMO && (
        <div className="banner">
          🧪 <b>Modo demonstração</b> — dados de exemplo, nada é gravado. Para valer de
          verdade, configure o Supabase seguindo o <b>docs/COMO-CONFIGURAR.md</b>.
        </div>
      )}
      {erro && <div className="banner erro">{erro}</div>}
      {erroPerfil && (
        <div className="banner erro banner-com-acao">
          ⚠️ {erroPerfil}
          <button className="usuario-btn" onClick={carregarPerfil}>
            Tentar de novo
          </button>
        </div>
      )}

      {abaAtiva === 'feed' && (
        <Feed
          noticias={noticias}
          total={totalNoticias}
          filtros={filtros}
          aoMudarFiltros={setFiltros}
          aoCarregarMais={carregarMais}
          carregandoMais={carregandoMais}
          aoRecarregar={() => carregarFeed(filtros, 0)}
          indicadores={indicadores}
          radar={radar}
          aoAtualizar={carregarRadar}
          usuario={email}
          demo={DEMO}
          aoEnviarDemo={(item) => setRadar((atuais) => [item, ...atuais])}
          ordemAplicada={ordemAplicada}
          avisoOrdem={avisoOrdem}
        />
      )}
      {abaAtiva === 'radar' && (
        <Radar
          itens={radar}
          setItens={setRadar}
          aoAtualizar={carregarRadar}
          usuario={email}
          demo={DEMO}
          abertoId={cardAberto}
          aoAbrirCard={setCardAberto}
        />
      )}
      {abaAtiva === 'usuarios' && perfil?.is_admin && <Usuarios usuarioEmail={email} demo={DEMO} />}
      {abaAtiva === 'atividade' && perfil?.is_admin && <Atividade demo={DEMO} />}
    </div>
  )
}
