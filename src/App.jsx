import { useCallback, useEffect, useState } from 'react'
import { supabase, configurado } from './lib/supabaseClient.js'
import { iniciais } from './lib/util.js'
import { NOTICIAS_DEMO, RADAR_DEMO } from './lib/demo.js'
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

export default function App() {
  const [sessao, setSessao] = useState(null)
  const [autenticacaoPronta, setAutenticacaoPronta] = useState(false)
  const [aba, setAba] = useState('feed')
  const [noticias, setNoticias] = useState(DEMO ? NOTICIAS_DEMO : null) // null = carregando
  const [radar, setRadar] = useState(DEMO ? RADAR_DEMO : null)
  const [erro, setErro] = useState('')
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

  // Carrega o feed e o radar do banco
  const carregar = useCallback(async () => {
    if (DEMO) return
    setErro('')
    const [n, r] = await Promise.all([
      supabase
        .from('noticias')
        .select('*')
        .order('data_publicacao', { ascending: false, nullsFirst: false })
        .limit(300),
      supabase
        .from('radar_itens')
        .select('*, noticia:noticias(*)')
        .order('criado_em', { ascending: false }),
    ])
    if (n.error || r.error) {
      setErro(`Não consegui carregar os dados: ${(n.error ?? r.error).message}`)
      return
    }
    setNoticias(n.data)
    setRadar(r.data)
  }, [])

  useEffect(() => {
    if (sessao) carregar()
  }, [sessao, carregar])

  // Busca o perfil (nome, admin, ativo); acesso desativado é barrado aqui também
  useEffect(() => {
    if (DEMO || !sessao) return
    supabase
      .from('perfis')
      .select('*')
      .eq('id', sessao.user.id)
      .single()
      .then(({ data }) => {
        if (data && data.ativo === false) {
          alert('Seu acesso foi desativado. Fale com um administrador.')
          supabase.auth.signOut()
          return
        }
        setPerfil(data ?? { nome: '', is_admin: false, ativo: true })
      })
  }, [sessao])

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
            <button key={id} className={aba === id ? 'ativo' : ''} onClick={() => setAba(id)}>
              {rotulo}
              {id === 'radar' && encontrados > 0 ? ` (${encontrados})` : ''}
            </button>
          ))}
        </nav>
        <div className="usuario-area">
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

      {aba === 'feed' && (
        <Feed
          noticias={noticias}
          radar={radar}
          aoAtualizar={carregar}
          usuario={email}
          demo={DEMO}
          aoEnviarDemo={(noticia) =>
            setRadar((atuais) => [
              {
                id: `demo-envio-${noticia.id}`,
                noticia_id: noticia.id,
                status: 'Encontrado',
                responsavel: '',
                observacoes: '',
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString(),
                noticia,
              },
              ...atuais,
            ])
          }
        />
      )}
      {aba === 'radar' && (
        <Radar
          itens={radar}
          setItens={setRadar}
          aoAtualizar={carregar}
          usuario={email}
          demo={DEMO}
        />
      )}
      {aba === 'usuarios' && perfil?.is_admin && <Usuarios usuarioEmail={email} demo={DEMO} />}
      {aba === 'atividade' && perfil?.is_admin && <Atividade demo={DEMO} />}
    </div>
  )
}
