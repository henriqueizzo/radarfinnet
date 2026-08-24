// Janela de detalhes de um card do Radar (extraída de abas/Radar.jsx).
// Mostra a notícia, permite trocar status, responsável, observações e
// temas manuais, exibe o histórico e remove o card do Radar.
import { useEffect, useState } from 'react'
import { STATUS, ROTULOS } from '../lib/statusRadar.js'
import { buscarHistorico, salvarCard, salvarTemasManuais, removerCard } from '../lib/api.js'
import { TEMAS } from '../lib/catalogos.js'
import { tempoRelativo, dataCompleta, dataCurta, ehInforme } from '../lib/util.js'
import { useAvisos } from './Avisos.jsx'
import ResumoNoticia from './ResumoNoticia.jsx'

export default function JanelaDetalhe({ item, fechar, mover, aoAtualizar, usuario, demo, setItens }) {
  const noticia = item.noticia ?? {}
  const { toast, confirmar } = useAvisos()
  const [responsavel, setResponsavel] = useState(item.responsavel ?? '')
  const [observacoes, setObservacoes] = useState(item.observacoes ?? '')
  // Temas manuais do TIME (os automáticos do coletor não se apagam daqui)
  const [temasManuais, setTemasManuais] = useState(noticia.temas_manuais ?? [])
  const [novoTema, setNovoTema] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [expandida, setExpandida] = useState(false)
  const [minimizada, setMinimizada] = useState(false)
  const [historico, setHistorico] = useState(null) // null = carregando
  const [erroHistorico, setErroHistorico] = useState('')
  const [tentativa, setTentativa] = useState(0) // +1 = "Tentar de novo"

  useEffect(() => {
    let ativo = true
    setHistorico(null)
    setErroHistorico('')
    buscarHistorico({ demo, radarId: item.id }).then((r) => {
      if (!ativo) return
      if (r.ok) setHistorico(r.eventos)
      else setErroHistorico(r.erro)
    })
    return () => {
      ativo = false
    }
  }, [item.id, item.status, demo, tentativa])

  function adicionarTema() {
    const tema = novoTema.trim()
    if (!tema) return
    const jaTem = (noticia.temas ?? []).includes(tema) || temasManuais.includes(tema)
    if (jaTem) toast('Este tema já está na notícia.', 'info')
    else setTemasManuais((atuais) => [...atuais, tema])
    setNovoTema('')
  }

  async function salvar() {
    setSalvando(true)
    const r = await salvarCard({ demo, item, responsavel, observacoes, usuario })
    if (!r.ok) {
      setSalvando(false)
      toast(`Não consegui salvar: ${r.erro}`, 'erro')
      return
    }
    // Os temas manuais moram na NOTÍCIA (não no card) — salva separado, só se mudou
    const temasMudaram =
      JSON.stringify(temasManuais) !== JSON.stringify(noticia.temas_manuais ?? [])
    if (temasMudaram && noticia.id) {
      const rt = await salvarTemasManuais({ demo, noticia, temas: temasManuais, usuario })
      if (!rt.ok) {
        setSalvando(false)
        toast(rt.erro, 'erro')
        return
      }
    }
    setSalvando(false)
    setItens((atuais) =>
      atuais.map((i) =>
        i.id === item.id
          ? { ...i, responsavel, observacoes, noticia: { ...i.noticia, temas_manuais: temasManuais } }
          : i,
      ),
    )
    await aoAtualizar()
    toast('Alterações salvas.', 'ok')
    fechar()
  }

  async function remover() {
    const confirmou = await confirmar({
      titulo: 'Remover do Radar',
      mensagem:
        'Remover este item do Radar? O card, as observações e o histórico serão perdidos — não tem desfazer. (A notícia continua no Feed.)',
      confirmarTexto: '🗑️ Remover',
      perigoso: true,
    })
    if (!confirmou) return
    const r = await removerCard({ demo, item, usuario })
    if (!r.ok) {
      toast(`Não consegui remover: ${r.erro}`, 'erro')
      return
    }
    setItens((atuais) => atuais.filter((i) => i.id !== item.id))
    await aoAtualizar()
    toast('Item removido do Radar.', 'ok')
    fechar()
  }

  if (minimizada) {
    return (
      <div className="janela-min" onClick={() => setMinimizada(false)} title="Clique para restaurar">
        <span className="janela-min-titulo">🎯 {noticia.titulo}</span>
      </div>
    )
  }

  return (
    <div className={`modal-fundo ${expandida ? 'modal-fundo-max' : ''}`} onClick={fechar}>
      <div className={`janela ${expandida ? 'janela-max' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="janela-cabecalho">
          <strong title={noticia.titulo}>{noticia.titulo}</strong>
          <div className="janela-botoes">
            <button aria-label="Minimizar" onClick={() => setMinimizada(true)}>─</button>
            <button aria-label="Expandir" onClick={() => setExpandida((v) => !v)}>⛶</button>
            <button aria-label="Fechar" onClick={fechar}>✕</button>
          </div>
        </div>
        <div className="janela-corpo">
          <div className="cartao-meta" style={{ marginBottom: 10 }}>
            <span>{noticia.fonte}</span>
            <span>{noticia.categoria}</span>
            <span title={dataCompleta(noticia.data_publicacao)}>
              {ehInforme(noticia)
                ? `📨 Data de envio: ${dataCurta(noticia.data_publicacao)}`
                : tempoRelativo(noticia.data_publicacao)}
            </span>
          </div>
          <ResumoNoticia resumo={noticia.resumo} completo />
          <p style={{ marginTop: 8 }}>
            <a href={noticia.url} target="_blank" rel="noreferrer">
              Abrir documento na fonte ↗
            </a>
          </p>

          <p className="secao-rotulo">Temas</p>
          <div className="temas-chips">
            {(noticia.temas ?? []).map((t) => (
              <span key={t} className="selo" title="Tema aplicado automaticamente pelo coletor">
                {t}
              </span>
            ))}
            {temasManuais.map((t) => (
              <span key={t} className="selo selo-manual" title="Tema adicionado manualmente pelo time">
                {t}
                <button
                  aria-label={`Remover o tema ${t}`}
                  onClick={() => setTemasManuais((atuais) => atuais.filter((x) => x !== t))}
                >
                  ×
                </button>
              </span>
            ))}
            {(noticia.temas ?? []).length === 0 && temasManuais.length === 0 && (
              <span className="tile-d">Sem temas ainda — adicione abaixo.</span>
            )}
          </div>
          <div className="tema-adicionar">
            <input
              type="text"
              list="catalogo-temas"
              value={novoTema}
              onChange={(e) => setNovoTema(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  adicionarTema()
                }
              }}
              placeholder="Adicionar tema (ex.: Pix)"
            />
            <datalist id="catalogo-temas">
              {TEMAS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <button className="usuario-btn" onClick={adicionarTema}>
              + Adicionar
            </button>
          </div>

          <p className="secao-rotulo">Status</p>
          <div className="status-opcoes">
            {STATUS.map((s) => (
              <button key={s} className={s === item.status ? 'ativo' : ''} onClick={() => mover(item, s)}>
                {ROTULOS[s]}
              </button>
            ))}
          </div>

          <p className="secao-rotulo">Responsável</p>
          <input
            type="text"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="Nome de quem vai cuidar desta mudança"
          />

          <p className="secao-rotulo">Observações</p>
          <textarea
            rows={4}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Impacto para a Finnet, prazos, decisões da equipe…"
          />

          <p className="secao-rotulo">Histórico</p>
          {erroHistorico && (
            <div className="erro-recarregar">
              ⚠️ Não consegui carregar o histórico: {erroHistorico}
              <button className="usuario-btn" onClick={() => setTentativa((t) => t + 1)}>
                Tentar de novo
              </button>
            </div>
          )}
          {!erroHistorico && historico === null && <p className="pendente">Carregando o histórico…</p>}
          {historico?.length === 0 && <p className="dash-vazio">Sem movimentações registradas.</p>}
          {historico?.length > 0 && (
            <div className="historico">
              {historico.map((ev) => (
                <span key={ev.id}>
                  {ev.de_status ? `${ev.de_status} → ` : ''}
                  <strong>{ev.para_status}</strong>
                  {' — '}
                  {ev.usuario_email || 'coletor automático'} ·{' '}
                  <span title={dataCompleta(ev.quando)}>{tempoRelativo(ev.quando)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="janela-rodape">
            <button className="usuario-btn btn-excluir" onClick={remover}>
              🗑️ Remover do Radar
            </button>
            <button className="primario" onClick={salvar} disabled={salvando}>
              {salvando ? '⏳ Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
