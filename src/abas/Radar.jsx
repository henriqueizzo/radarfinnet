import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { supabase } from '../lib/supabaseClient.js'
import { registrarAtividade } from '../lib/atividade.js'
import { tempoRelativo, dataCompleta, iniciais } from '../lib/util.js'

const STATUS = ['Encontrado', 'Avaliando', 'Desenvolvimento', 'Entregue']
const ROTULOS = {
  Encontrado: '🔎 Encontrado',
  Avaliando: '🧐 Avaliando',
  Desenvolvimento: '🛠️ Desenvolvimento',
  Entregue: '✅ Entregue',
}
const FAIXAS = {
  Encontrado: 'faixa-amarelo',
  Avaliando: 'faixa-azul',
  Desenvolvimento: 'faixa-azul',
  Entregue: 'faixa-verde',
}
const VAZIOS = {
  Encontrado: 'Nada por aqui — o coletor adiciona normativos sozinho, ou use "Enviar ao Radar" no Feed.',
  Avaliando: 'Nenhuma mudança em avaliação.',
  Desenvolvimento: 'Nada em desenvolvimento no momento.',
  Entregue: 'Nenhuma entrega concluída ainda.',
}

export default function Radar({ itens, setItens, aoAtualizar, usuario, demo }) {
  const [arrastandoId, setArrastandoId] = useState(null)
  const [abertoId, setAbertoId] = useState(null)

  const sensores = useSensors(
    // 6px de movimento separam o clique do arraste; no toque, segurar 250ms
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  if (itens === null) return <p className="pendente">Carregando o radar…</p>

  const arrastando = itens.find((i) => i.id === arrastandoId)
  const aberto = itens.find((i) => i.id === abertoId)

  // Atualização otimista: a tela muda na hora; se a API falhar, recarrega
  async function mover(item, novoStatus) {
    if (novoStatus === item.status) return
    const statusAnterior = item.status
    setItens((atuais) => atuais.map((i) => (i.id === item.id ? { ...i, status: novoStatus } : i)))
    if (demo) return // no modo demonstração, só muda na tela
    const { error } = await supabase
      .from('radar_itens')
      .update({ status: novoStatus })
      .eq('id', item.id)
    if (error) {
      alert(`Não consegui mover o card: ${error.message}`)
      aoAtualizar()
      return
    }
    await supabase.from('radar_eventos').insert({
      radar_id: item.id,
      de_status: statusAnterior,
      para_status: novoStatus,
      usuario_email: usuario,
    })
    registrarAtividade({
      usuario,
      tipo: 'mover_status',
      detalhe: `${statusAnterior} → ${novoStatus} — ${item.noticia?.titulo ?? ''}`,
      noticiaId: item.noticia_id,
    })
  }

  return (
    <>
      <DndContext
        sensors={sensores}
        onDragStart={(e) => setArrastandoId(e.active.id)}
        onDragCancel={() => setArrastandoId(null)}
        onDragEnd={(e) => {
          const destino = e.over?.id
          const item = itens.find((i) => i.id === e.active.id)
          setArrastandoId(null)
          if (item && destino && STATUS.includes(destino)) mover(item, destino)
        }}
      >
        <div className="kanban">
          {STATUS.map((status) => (
            <Coluna
              key={status}
              status={status}
              itens={itens.filter((i) => i.status === status)}
              arrastandoId={arrastandoId}
              mover={mover}
              abrir={setAbertoId}
            />
          ))}
        </div>
        <DragOverlay>
          {arrastando ? (
            <CartaoRadar item={arrastando} classe="arrastando" mover={() => {}} abrir={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {aberto && (
        <JanelaDetalhe
          item={aberto}
          fechar={() => setAbertoId(null)}
          mover={mover}
          aoAtualizar={aoAtualizar}
          usuario={usuario}
          demo={demo}
          setItens={setItens}
        />
      )}
    </>
  )
}

function Coluna({ status, itens, arrastandoId, mover, abrir }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section ref={setNodeRef} className={`coluna ${isOver ? 'solta-aqui' : ''}`}>
      <h3>
        {ROTULOS[status]} <span>{itens.length}</span>
      </h3>
      {itens.length === 0 && <p className="dash-vazio">{VAZIOS[status]}</p>}
      {itens.map((item) => (
        <CartaoArrastavel
          key={item.id}
          item={item}
          fantasma={item.id === arrastandoId}
          mover={mover}
          abrir={abrir}
        />
      ))}
    </section>
  )
}

function CartaoArrastavel({ item, fantasma, mover, abrir }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: item.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <CartaoRadar item={item} classe={fantasma ? 'fantasma' : 'clicavel'} mover={mover} abrir={abrir} />
    </div>
  )
}

function CartaoRadar({ item, classe = '', mover, abrir }) {
  const noticia = item.noticia ?? {}
  const posicao = STATUS.indexOf(item.status)
  return (
    <article className={`cartao ${FAIXAS[item.status] ?? ''} ${classe}`}>
      <div className="cartao-topo">
        <span className="cartao-titulo" title={noticia.titulo}>
          {noticia.titulo}
        </span>
        <span
          className={`resp-chip ${item.responsavel ? '' : 'vazio'}`}
          title={item.responsavel || 'Sem responsável — abra os detalhes para definir'}
        >
          {item.responsavel ? iniciais(item.responsavel) : '+'}
        </span>
      </div>
      {noticia.resumo && <p className="cartao-resumo">{noticia.resumo}</p>}
      <div className="cartao-meta">
        <span>{noticia.fonte}</span>
        <span title={dataCompleta(noticia.data_publicacao)}>
          {tempoRelativo(noticia.data_publicacao)}
        </span>
      </div>
      {mover && (
        <div className="acoes">
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              aria-label="Mover para a etapa anterior"
              disabled={posicao === 0}
              onClick={(e) => {
                e.stopPropagation()
                mover(item, STATUS[posicao - 1])
              }}
            >
              ←
            </button>
            <button
              aria-label="Mover para a próxima etapa"
              disabled={posicao === STATUS.length - 1}
              onClick={(e) => {
                e.stopPropagation()
                mover(item, STATUS[posicao + 1])
              }}
            >
              →
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              abrir(item.id)
            }}
          >
            Detalhes
          </button>
        </div>
      )}
    </article>
  )
}

function JanelaDetalhe({ item, fechar, mover, aoAtualizar, usuario, demo, setItens }) {
  const noticia = item.noticia ?? {}
  const [responsavel, setResponsavel] = useState(item.responsavel ?? '')
  const [observacoes, setObservacoes] = useState(item.observacoes ?? '')
  const [salvando, setSalvando] = useState(false)
  const [expandida, setExpandida] = useState(false)
  const [minimizada, setMinimizada] = useState(false)
  const [historico, setHistorico] = useState(null)

  useEffect(() => {
    if (demo) {
      setHistorico([]) // no modo demonstração não há histórico gravado
      return
    }
    supabase
      .from('radar_eventos')
      .select('*')
      .eq('radar_id', item.id)
      .order('quando', { ascending: false })
      .then(({ data }) => setHistorico(data ?? []))
  }, [item.id, item.status, demo])

  async function salvar() {
    if (demo) {
      setItens((atuais) =>
        atuais.map((i) => (i.id === item.id ? { ...i, responsavel, observacoes } : i)),
      )
      fechar()
      return
    }
    setSalvando(true)
    const { error } = await supabase
      .from('radar_itens')
      .update({ responsavel, observacoes })
      .eq('id', item.id)
    setSalvando(false)
    if (error) {
      alert(`Não consegui salvar: ${error.message}`)
      return
    }
    registrarAtividade({
      usuario,
      tipo: 'editar_card',
      detalhe: noticia.titulo,
      noticiaId: item.noticia_id,
    })
    await aoAtualizar()
    fechar()
  }

  async function remover() {
    const confirmou = window.confirm(
      'Remover este item do Radar? O card, as observações e o histórico serão perdidos — não tem desfazer. (A notícia continua no Feed.)',
    )
    if (!confirmou) return
    if (demo) {
      setItens((atuais) => atuais.filter((i) => i.id !== item.id))
      fechar()
      return
    }
    const { error } = await supabase.from('radar_itens').delete().eq('id', item.id)
    if (error) {
      alert(`Não consegui remover: ${error.message}`)
      return
    }
    registrarAtividade({
      usuario,
      tipo: 'remover_card',
      detalhe: noticia.titulo,
      noticiaId: item.noticia_id,
    })
    await aoAtualizar()
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
              {tempoRelativo(noticia.data_publicacao)}
            </span>
          </div>
          {noticia.resumo && <p style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>{noticia.resumo}</p>}
          <p style={{ marginTop: 8 }}>
            <a href={noticia.url} target="_blank" rel="noreferrer">
              Abrir documento na fonte ↗
            </a>
          </p>

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
          {historico === null && <p className="pendente">Carregando o histórico…</p>}
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
