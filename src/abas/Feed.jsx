import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { registrarAtividade } from '../lib/atividade.js'
import { tempoRelativo, dataCompleta, semAcentos } from '../lib/util.js'

const FONTES = ['Banco Central', 'Coaf', 'Febraban', 'Open Finance']
const CATEGORIAS = ['Normativo', 'Comunicado', 'Notícia', 'Wiki', 'Release']

// Faixa lateral: âmbar = normativo (pede atenção), azul = comunicado/release
function faixaDaNoticia(noticia) {
  if (noticia.categoria === 'Normativo') return 'faixa-amarelo'
  if (noticia.categoria === 'Comunicado' || noticia.categoria === 'Release') return 'faixa-azul'
  return ''
}

export default function Feed({ noticias, radar, aoAtualizar, usuario, demo, aoEnviarDemo }) {
  const [busca, setBusca] = useState('')
  const [fonte, setFonte] = useState('')
  const [categoria, setCategoria] = useState('')
  const [tema, setTema] = useState('')
  const [enviandoId, setEnviandoId] = useState(null)

  if (noticias === null) return <p className="pendente">Carregando o feed…</p>

  const idsNoRadar = new Set((radar ?? []).map((item) => item.noticia_id))
  const temasDisponiveis = [...new Set(noticias.flatMap((n) => n.temas ?? []))].sort()

  const filtradas = noticias.filter((n) => {
    if (fonte && n.fonte !== fonte) return false
    if (categoria && n.categoria !== categoria) return false
    if (tema && !(n.temas ?? []).includes(tema)) return false
    if (busca && !semAcentos(`${n.titulo} ${n.resumo}`).includes(semAcentos(busca))) return false
    return true
  })
  const temFiltro = busca || fonte || categoria || tema

  // Indicadores do cockpit
  const seteDias = Date.now() - 7 * 24 * 60 * 60 * 1000
  const trintaDias = Date.now() - 30 * 24 * 60 * 60 * 1000
  const novidades7d = noticias.filter((n) => new Date(n.data_publicacao) > seteDias).length
  const normativos30d = noticias.filter(
    (n) => n.categoria === 'Normativo' && new Date(n.data_publicacao) > trintaDias,
  ).length
  const emAndamento = (radar ?? []).filter((i) => i.status !== 'Entregue').length
  const ultimaColeta = noticias.reduce(
    (maior, n) => (n.criado_em > maior ? n.criado_em : maior),
    '',
  )

  async function enviarAoRadar(noticia) {
    if (demo) {
      aoEnviarDemo(noticia) // no modo demonstração, só muda na tela
      return
    }
    setEnviandoId(noticia.id)
    const { data, error } = await supabase
      .from('radar_itens')
      .insert({ noticia_id: noticia.id })
      .select('id')
      .single()
    if (error) {
      alert(`Não consegui enviar ao Radar: ${error.message}`)
    } else {
      // registra no histórico quem encontrou
      await supabase.from('radar_eventos').insert({
        radar_id: data.id,
        de_status: null,
        para_status: 'Encontrado',
        usuario_email: usuario,
      })
      registrarAtividade({
        usuario,
        tipo: 'enviar_radar',
        detalhe: noticia.titulo,
        noticiaId: noticia.id,
      })
      await aoAtualizar()
    }
    setEnviandoId(null)
  }

  return (
    <>
      <div className="cockpit">
        <div className="tile">
          <span className="tile-k">
            <span className="led" /> Novidades (7 dias)
          </span>
          <span className="tile-v">{novidades7d}</span>
          <span className="tile-d" title={dataCompleta(ultimaColeta)}>
            última coleta {tempoRelativo(ultimaColeta)}
          </span>
        </div>
        <div className="tile">
          <span className="tile-k">Normativos (30 dias)</span>
          <span className="tile-v">{normativos30d}</span>
          <span className="tile-d">resoluções, instruções e afins</span>
        </div>
        <div className="tile">
          <span className="tile-k">No Radar</span>
          <span className="tile-v">{emAndamento}</span>
          <span className="tile-d">mudanças ainda não entregues</span>
        </div>
        <div className="tile">
          <span className="tile-k">Fontes monitoradas</span>
          <span className="tile-v">5</span>
          <span className="tile-d">BCB · Coaf · Febraban · Open Finance · DOU</span>
        </div>
      </div>

      <div className="barra-busca">
        <div className="campo-busca">
          <svg className="campo-busca-lupa" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por título ou resumo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button className="campo-busca-limpar" aria-label="Limpar busca" onClick={() => setBusca('')}>
              ×
            </button>
          )}
        </div>
        <select className="filtro-select" value={fonte} onChange={(e) => setFonte(e.target.value)}>
          <option value="">Todas as fontes</option>
          {FONTES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select className="filtro-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todos os tipos</option>
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="filtro-select" value={tema} onChange={(e) => setTema(e.target.value)}>
          <option value="">Todos os temas</option>
          {temasDisponiveis.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {temFiltro && (
          <span className="busca-contagem">
            {filtradas.length} de {noticias.length}
          </span>
        )}
      </div>

      {noticias.length === 0 && (
        <p className="dash-vazio">
          Nenhuma novidade ainda — rode o coletor (npm run coletar) para preencher o feed.
        </p>
      )}
      {noticias.length > 0 && filtradas.length === 0 && (
        <p className="dash-vazio">Nada encontrado com esses filtros — tente limpar a busca.</p>
      )}

      <div className="feed-lista">
        {filtradas.map((n) => (
          <article key={n.id} className={`cartao ${faixaDaNoticia(n)}`}>
            <div className="cartao-topo">
              <span className="cartao-titulo" title={n.titulo}>
                {n.titulo}
              </span>
              <span className={`veredito ${n.categoria === 'Normativo' ? 'amarelo' : 'azul'}`}>
                {n.categoria}
              </span>
            </div>
            {n.resumo && (
              <p className="cartao-resumo" title={n.resumo}>
                {n.resumo}
              </p>
            )}
            {(n.temas ?? []).length > 0 && (
              <div className="temas-chips">
                {n.temas.map((t) => (
                  <span key={t} className="selo">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="cartao-meta">
              <span>{n.fonte}</span>
              <span title={dataCompleta(n.data_publicacao)}>{tempoRelativo(n.data_publicacao)}</span>
            </div>
            <div className="acoes">
              <a href={n.url} target="_blank" rel="noreferrer">
                Abrir na fonte ↗
              </a>
              {idsNoRadar.has(n.id) ? (
                <button disabled title="Este item já está no Radar">
                  🎯 No Radar ✓
                </button>
              ) : (
                <button onClick={() => enviarAoRadar(n)} disabled={enviandoId === n.id}>
                  {enviandoId === n.id ? '⏳ Enviando…' : '🎯 Enviar ao Radar'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
