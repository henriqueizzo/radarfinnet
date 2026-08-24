import { useState } from 'react'
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
import { STATUS, ROTULOS, FAIXAS, VAZIOS } from '../lib/statusRadar.js'
import { moverStatusCard } from '../lib/api.js'
import { baixarCsv } from '../lib/csv.js'
import {
  tempoRelativo,
  dataCompleta,
  dataCurta,
  iniciais,
  temasDaNoticia,
  dataParaArquivo,
  ehInforme,
} from '../lib/util.js'
import { useAvisos } from '../componentes/Avisos.jsx'
import JanelaDetalhe from '../componentes/JanelaDetalhe.jsx'
import ResumoNoticia from '../componentes/ResumoNoticia.jsx'

// O card aberto (abertoId) vem do App.jsx: assim ele entra na URL e o link
// compartilhado no Teams abre direto com a janela de detalhes na tela.
export default function Radar({ itens, setItens, aoAtualizar, usuario, demo, abertoId, aoAbrirCard }) {
  const { toast } = useAvisos()
  const [arrastandoId, setArrastandoId] = useState(null)

  const sensores = useSensors(
    // 6px de movimento separam o clique do arraste; no toque, segurar 250ms
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  if (itens === null) return <p className="pendente">Carregando o radar…</p>

  const arrastando = itens.find((i) => i.id === arrastandoId)
  // String() dos dois lados: o id vindo da URL chega como texto
  const aberto = itens.find((i) => String(i.id) === String(abertoId))

  // Atualização otimista: a tela muda na hora; se a API falhar, recarrega
  async function mover(item, novoStatus) {
    if (novoStatus === item.status) return
    setItens((atuais) => atuais.map((i) => (i.id === item.id ? { ...i, status: novoStatus } : i)))
    const r = await moverStatusCard({ demo, item, novoStatus, usuario })
    if (!r.ok) {
      toast(`Não consegui mover o card: ${r.erro}`, 'erro')
      aoAtualizar()
    }
  }

  // Baixa o quadro inteiro em CSV (Excel): um card por linha, na ordem das colunas
  function exportarCsv() {
    const linhas = [...itens]
      .sort((a, b) => STATUS.indexOf(a.status) - STATUS.indexOf(b.status))
      .map((i) => [
        ROTULOS[i.status] ?? i.status,
        i.noticia?.titulo ?? '',
        i.noticia?.fonte ?? '',
        i.noticia?.categoria ?? '',
        dataCompleta(i.noticia?.data_publicacao),
        i.responsavel ?? '',
        i.observacoes ?? '',
        temasDaNoticia(i.noticia).todos.join(', '),
        i.noticia?.url ?? '',
      ])
    baixarCsv({
      nomeArquivo: `radar-mudancas-${dataParaArquivo()}.csv`,
      cabecalhos: ['Status', 'Título', 'Fonte', 'Categoria', 'Publicada em', 'Responsável', 'Observações', 'Temas', 'Link'],
      linhas,
    })
    toast(`CSV baixado com ${linhas.length} card(s) — abre direto no Excel.`, 'ok')
  }

  return (
    <>
      <div className="radar-topo">
        <button
          className="usuario-btn"
          onClick={exportarCsv}
          disabled={itens.length === 0}
          title="Baixa um arquivo CSV (Excel) com os cards, status, responsáveis e observações"
        >
          ⬇️ Exportar CSV
        </button>
      </div>
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
              abrir={aoAbrirCard}
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
          fechar={() => aoAbrirCard(null)}
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
      <ResumoNoticia resumo={noticia.resumo} />
      <div className="cartao-meta">
        <span>{noticia.fonte}</span>
        <span title={dataCompleta(noticia.data_publicacao)}>
          {ehInforme(noticia)
            ? `📨 Data de envio: ${dataCurta(noticia.data_publicacao)}`
            : tempoRelativo(noticia.data_publicacao)}
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
