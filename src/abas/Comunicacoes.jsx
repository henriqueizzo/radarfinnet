// 📮 Comunicações — registro e tratamento do que chega pelos CANAIS FECHADOS
// do Banco Central e da governança do Open Finance (BC Correio, UNICAD,
// Protocolo Digital, Siscom/Siscon, CRD, cartas/ofícios…).
// Fluxo de tratamento: classificar o evento → identificar prazo, área,
// documentos, impacto e reporte à Diretoria → sugerir plano de ação →
// destacar o que está sem resposta → priorizar o que tem prazo.
import { useEffect, useState } from 'react'
import { listarComunicacoes, salvarComunicacao, removerComunicacao } from '../lib/api.js'
import {
  CANAIS_COMUNICACAO,
  TIPOS_EVENTO,
  STATUS_RESPOSTA,
  diasParaPrazo,
  prazoPorExtenso,
  sugerirPlanoAcao,
} from '../lib/comunicacoes.js'
import { dataCompleta } from '../lib/util.js'
import { useAvisos } from '../componentes/Avisos.jsx'

// "AAAA-MM-DD" de hoje, no fuso local (valor inicial de "recebida em")
function hojeIso() {
  const d = new Date()
  const dois = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

const VAZIA = {
  id: '',
  canal: 'BC Correio',
  tipo: 'Informação',
  assunto: '',
  descricao: '',
  recebida_em: '',
  prazo: '',
  area_responsavel: '',
  documentos: '',
  impacto: '',
  reporte_diretoria: false,
  plano_acao: '',
  status_resposta: 'Sem resposta',
}

// Prioriza quem tem prazo (item 5): vencidas primeiro, depois prazo mais
// perto; sem prazo vem depois (mais recentes primeiro); respondidas por último.
function ordenar(lista) {
  const chave = (c) => {
    if (c.status_resposta === 'Respondida') return [2, 0]
    const dias = diasParaPrazo(c.prazo)
    if (dias === null) return [1, 0]
    return [0, dias]
  }
  return [...lista].sort((a, b) => {
    const [ga, da] = chave(a)
    const [gb, db] = chave(b)
    if (ga !== gb) return ga - gb
    if (ga === 0) return da - db
    return (b.recebida_em ?? '').localeCompare(a.recebida_em ?? '')
  })
}

export default function Comunicacoes({ usuario, demo }) {
  const { toast, confirmar } = useAvisos()
  const [comunicacoes, setComunicacoes] = useState(null) // null = carregando
  const [erro, setErro] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('abertas')
  const [emEdicao, setEmEdicao] = useState(null) // null = janela fechada
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const r = await listarComunicacoes({ demo })
    if (!r.ok) {
      setErro(r.erro)
      setComunicacoes((atuais) => atuais ?? [])
      return
    }
    setErro('')
    setComunicacoes(r.comunicacoes)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (comunicacoes === null) return <p className="pendente">Carregando as comunicações…</p>

  const abertas = comunicacoes.filter((c) => c.status_resposta !== 'Respondida')
  const semResposta = comunicacoes.filter((c) => c.status_resposta === 'Sem resposta')
  const vencidas = abertas.filter((c) => {
    const dias = diasParaPrazo(c.prazo)
    return dias !== null && dias < 0
  })
  const prazoProximo = abertas.filter((c) => {
    const dias = diasParaPrazo(c.prazo)
    return dias !== null && dias >= 0 && dias <= 7
  })

  const visiveis = ordenar(
    comunicacoes.filter((c) => {
      if (filtroStatus === 'abertas') return c.status_resposta !== 'Respondida'
      if (filtroStatus === 'todas') return true
      return c.status_resposta === filtroStatus
    }),
  )

  function abrirNova() {
    setEmEdicao({ ...VAZIA, recebida_em: hojeIso() })
  }

  function abrirEdicao(c) {
    setEmEdicao({
      ...VAZIA,
      ...c,
      recebida_em: c.recebida_em ?? '',
      prazo: c.prazo ?? '',
    })
  }

  async function salvar(evento) {
    evento.preventDefault()
    if (!emEdicao.assunto.trim()) {
      toast('Descreva o assunto da comunicação.', 'erro')
      return
    }
    setSalvando(true)
    const r = await salvarComunicacao({
      demo,
      usuario,
      comunicacao: {
        ...emEdicao,
        assunto: emEdicao.assunto.trim(),
        // campos de data vazios viram null (o banco não aceita '' em date)
        recebida_em: emEdicao.recebida_em || null,
        prazo: emEdicao.prazo || null,
      },
    })
    setSalvando(false)
    if (!r.ok) {
      toast(r.erro, 'erro')
      return
    }
    if (r.salvaDemo) {
      // modo demonstração: muda só na tela (some ao recarregar)
      setComunicacoes((atuais) =>
        emEdicao.id ? atuais.map((c) => (c.id === emEdicao.id ? r.salvaDemo : c)) : [r.salvaDemo, ...atuais],
      )
    } else {
      await carregar()
    }
    toast(emEdicao.id ? 'Comunicação atualizada.' : 'Comunicação registrada.', 'ok')
    setEmEdicao(null)
  }

  async function marcarRespondida(c) {
    const r = await salvarComunicacao({
      demo,
      usuario,
      comunicacao: {
        ...c,
        recebida_em: c.recebida_em || null,
        prazo: c.prazo || null,
        status_resposta: 'Respondida',
      },
    })
    if (!r.ok) {
      toast(r.erro, 'erro')
      return
    }
    if (r.salvaDemo) {
      setComunicacoes((atuais) => atuais.map((x) => (x.id === c.id ? r.salvaDemo : x)))
    } else {
      await carregar()
    }
    toast('Marcada como respondida. ✔', 'ok')
  }

  async function remover(c) {
    const confirmou = await confirmar({
      titulo: 'Remover comunicação',
      mensagem: `Remover o registro "${c.assunto}"? Não tem desfazer.`,
      confirmarTexto: '🗑️ Remover',
      perigoso: true,
    })
    if (!confirmou) return
    const r = await removerComunicacao({ demo, comunicacao: c, usuario })
    if (!r.ok) {
      toast(r.erro, 'erro')
      return
    }
    setComunicacoes((atuais) => atuais.filter((x) => x.id !== c.id))
    toast('Comunicação removida.', 'ok')
  }

  return (
    <>
      <div className="cockpit">
        <div className="tile">
          <span className="tile-k">❗ Sem resposta</span>
          <span className="tile-v">{semResposta.length}</span>
          <span className="tile-d">aguardando primeira tratativa</span>
        </div>
        <div className="tile">
          <span className="tile-k">⏰ Prazo em 7 dias</span>
          <span className="tile-v">{prazoProximo.length}</span>
          <span className="tile-d">responder antes de vencer</span>
        </div>
        <div className="tile">
          <span className="tile-k">🔴 Vencidas</span>
          <span className="tile-v">{vencidas.length}</span>
          <span className="tile-d">prazo estourado sem resposta</span>
        </div>
        <div className="tile">
          <span className="tile-k">📮 Registradas</span>
          <span className="tile-v">{comunicacoes.length}</span>
          <span className="tile-d">BC Correio · UNICAD · Protocolo · CRD…</span>
        </div>
      </div>

      {erro && <div className="banner erro">⚠️ {erro}</div>}

      <div className="barra-busca">
        <button className="primario" onClick={abrirNova}>
          ➕ Registrar comunicação
        </button>
        <select
          className="filtro-select"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
        >
          <option value="abertas">Em aberto (sem resposta + em andamento)</option>
          {STATUS_RESPOSTA.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="todas">Todas</option>
        </select>
        <span className="busca-contagem">
          {visiveis.length} de {comunicacoes.length}
        </span>
      </div>

      {visiveis.length === 0 && (
        <p className="dash-vazio">
          Nada por aqui — registre o que chegar pelo BC Correio, UNICAD, Protocolo Digital e demais
          canais oficiais.
        </p>
      )}

      <div className="feed-lista">
        {visiveis.map((c) => (
          <CartaoComunicacao
            key={c.id}
            c={c}
            aoEditar={() => abrirEdicao(c)}
            aoResponder={() => marcarRespondida(c)}
            aoRemover={() => remover(c)}
          />
        ))}
      </div>

      {emEdicao && (
        <JanelaComunicacao
          dados={emEdicao}
          setDados={setEmEdicao}
          salvando={salvando}
          aoSalvar={salvar}
          aoFechar={() => setEmEdicao(null)}
        />
      )}
    </>
  )
}

function CartaoComunicacao({ c, aoEditar, aoResponder, aoRemover }) {
  const dias = diasParaPrazo(c.prazo)
  const respondida = c.status_resposta === 'Respondida'
  const vencida = !respondida && dias !== null && dias < 0
  const urgente = !respondida && dias !== null && dias >= 0 && dias <= 7

  const faixa = respondida ? 'faixa-verde' : vencida ? 'faixa-vermelho' : urgente ? 'faixa-amarelo' : 'faixa-azul'

  return (
    <article className={`cartao ${faixa}`}>
      <div className="cartao-topo">
        <span className="cartao-titulo" title={c.assunto}>
          {c.assunto}
        </span>
        <span className="veredito cinza">{c.canal}</span>
        <span className="veredito azul">{c.tipo}</span>
      </div>

      <div className="temas-chips">
        {vencida && (
          <span className="veredito vermelho">⏰ Vencida há {Math.abs(dias)} dia(s)</span>
        )}
        {urgente && (
          <span className="veredito amarelo">
            {dias === 0 ? '⏰ Vence HOJE' : `⏰ Vence em ${dias} dia(s)`}
          </span>
        )}
        {!respondida && c.status_resposta === 'Sem resposta' && (
          <span className="veredito vermelho">❗ Sem resposta</span>
        )}
        {c.status_resposta === 'Em andamento' && <span className="veredito amarelo">🔄 Em andamento</span>}
        {respondida && <span className="veredito verde">✔ Respondida</span>}
        {c.reporte_diretoria && <span className="veredito amarelo">📢 Reportar à Diretoria</span>}
      </div>

      {c.descricao && <p className="cartao-resumo">{c.descricao}</p>}

      <div className="comunicacao-detalhes">
        {c.area_responsavel && (
          <span>
            <b>Área:</b> {c.area_responsavel}
          </span>
        )}
        {c.documentos && (
          <span>
            <b>Documentos:</b> {c.documentos}
          </span>
        )}
        {c.impacto && (
          <span>
            <b>Impacto:</b> {c.impacto}
          </span>
        )}
      </div>

      {c.plano_acao && (
        <details className="comunicacao-plano">
          <summary>📋 Plano de ação</summary>
          <pre>{c.plano_acao}</pre>
        </details>
      )}

      <div className="cartao-meta">
        {c.recebida_em && <span>recebida em {prazoPorExtenso(c.recebida_em)}</span>}
        {c.prazo && <span>prazo {prazoPorExtenso(c.prazo)}</span>}
        <span title={dataCompleta(c.criado_em)}>por {c.criado_por || '—'}</span>
      </div>

      <div className="acoes">
        <button onClick={aoEditar}>✏️ Editar</button>
        {!respondida && <button onClick={aoResponder}>✔ Marcar respondida</button>}
        <button onClick={aoRemover}>🗑️ Remover</button>
      </div>
    </article>
  )
}

function JanelaComunicacao({ dados, setDados, salvando, aoSalvar, aoFechar }) {
  const mudar = (parcial) => setDados((atuais) => ({ ...atuais, ...parcial }))

  function sugerir() {
    mudar({
      plano_acao: sugerirPlanoAcao({
        tipo: dados.tipo,
        canal: dados.canal,
        prazo: dados.prazo,
        area: dados.area_responsavel,
        documentos: dados.documentos,
        reporte: dados.reporte_diretoria,
      }),
    })
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="janela" onClick={(e) => e.stopPropagation()}>
        <div className="janela-cabecalho">
          <strong>{dados.id ? '✏️ Editar comunicação' : '📮 Registrar comunicação'}</strong>
          <div className="janela-botoes">
            <button aria-label="Fechar" onClick={aoFechar}>
              ✕
            </button>
          </div>
        </div>
        <div className="janela-corpo">
          <form className="formulario" onSubmit={aoSalvar}>
            <div className="formulario-linha">
              <label>
                Canal de origem
                <select value={dados.canal} onChange={(e) => mudar({ canal: e.target.value })}>
                  {CANAIS_COMUNICACAO.map((canal) => (
                    <option key={canal}>{canal}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo de evento
                <select value={dados.tipo} onChange={(e) => mudar({ tipo: e.target.value })}>
                  {TIPOS_EVENTO.map((tipo) => (
                    <option key={tipo}>{tipo}</option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Assunto
              <input
                type="text"
                value={dados.assunto}
                onChange={(e) => mudar({ assunto: e.target.value })}
                placeholder="Ex.: Ofício 1234/2026 — pedido de esclarecimentos sobre Pix"
              />
            </label>

            <label>
              Descrição
              <textarea
                rows={3}
                value={dados.descricao}
                onChange={(e) => mudar({ descricao: e.target.value })}
                placeholder="O que a comunicação pede/informa, número do documento, quem enviou…"
              />
            </label>

            <div className="formulario-linha">
              <label>
                Recebida em
                <input
                  type="date"
                  value={dados.recebida_em}
                  onChange={(e) => mudar({ recebida_em: e.target.value })}
                />
              </label>
              <label>
                Prazo para resposta (se houver)
                <input
                  type="date"
                  value={dados.prazo}
                  onChange={(e) => mudar({ prazo: e.target.value })}
                />
              </label>
            </div>

            <div className="formulario-linha">
              <label>
                Área responsável
                <input
                  type="text"
                  value={dados.area_responsavel}
                  onChange={(e) => mudar({ area_responsavel: e.target.value })}
                  placeholder="Ex.: Compliance, Jurídico, Produtos…"
                />
              </label>
              <label>
                Situação da resposta
                <select
                  value={dados.status_resposta}
                  onChange={(e) => mudar({ status_resposta: e.target.value })}
                >
                  {STATUS_RESPOSTA.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Documentos requeridos
              <input
                type="text"
                value={dados.documentos}
                onChange={(e) => mudar({ documentos: e.target.value })}
                placeholder="Ex.: política de PLD/FT, relatórios de volumetria…"
              />
            </label>

            <label>
              Impacto potencial
              <input
                type="text"
                value={dados.impacto}
                onChange={(e) => mudar({ impacto: e.target.value })}
                placeholder="Ex.: Alto — afeta a autorização como IP"
              />
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={dados.reporte_diretoria}
                onChange={(e) => mudar({ reporte_diretoria: e.target.checked })}
              />
              Precisa ser reportada à Diretoria/Conselho
            </label>

            <label>
              Plano de ação
              <textarea
                rows={6}
                value={dados.plano_acao}
                onChange={(e) => mudar({ plano_acao: e.target.value })}
                placeholder="Clique em 💡 Sugerir para gerar um plano a partir do tipo, prazo e área — depois ajuste à vontade."
              />
            </label>

            <div className="janela-rodape">
              <button type="button" className="usuario-btn" onClick={sugerir}>
                💡 Sugerir plano de ação
              </button>
              <button type="submit" className="primario" disabled={salvando}>
                {salvando ? '⏳ Salvando…' : dados.id ? 'Salvar alterações' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
