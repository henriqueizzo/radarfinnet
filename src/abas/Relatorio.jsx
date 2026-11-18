// 📑 Relatório — consolidado da vertical Split Payment & Reforma Tributária
// para um período: resumo executivo, números, destaques, quadro por banco,
// sinais de ação e situação das tratativas. Pronto para imprimir/salvar em
// PDF (botão 🖨️) ou exportar em CSV para levar à liderança.
import { useEffect, useMemo, useState } from 'react'
import { listarTributario } from '../lib/api.js'
import { NOMES_BANCOS, STATUS_TRIB, STATUS_ABERTOS } from '../lib/tributario.js'
import { SINAIS } from '../../coletor/tributario/analise.js'
import { dataCurta, dataParaArquivo } from '../lib/util.js'
import { baixarCsv } from '../lib/csv.js'

const DIA_MS = 24 * 60 * 60 * 1000

const PERIODOS = [
  ['7d', 'Últimos 7 dias'],
  ['30d', 'Últimos 30 dias'],
  ['90d', 'Últimos 90 dias'],
  ['mes', 'Mês atual'],
  ['mes-anterior', 'Mês anterior'],
  ['personalizado', 'Escolher período…'],
]

const TRATADAS = ['Ação definida', 'Concluído', 'Sem impacto']
const COR_STATUS = {
  Novo: 'vermelho',
  'Em análise': 'amarelo',
  'Ação definida': '',
  Concluído: 'verde',
  'Sem impacto': 'cinza',
  Histórico: 'cinza',
}

function isoDia(d) {
  const dois = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

// Devolve { inicio, fim } como Date (fim inclusivo até 23:59:59)
function intervalo(periodo, dataInicio, dataFim) {
  const hoje = new Date()
  const fimDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  if (periodo === 'mes') return { inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1), fim: fimDoDia(hoje) }
  if (periodo === 'mes-anterior') {
    return {
      inicio: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
      fim: fimDoDia(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
    }
  }
  if (periodo === 'personalizado') {
    const [ai, mi, di] = String(dataInicio).split('-').map(Number)
    const [af, mf, df] = String(dataFim).split('-').map(Number)
    return {
      inicio: ai ? new Date(ai, mi - 1, di) : new Date(0),
      fim: af ? fimDoDia(new Date(af, mf - 1, df)) : fimDoDia(hoje),
    }
  }
  const dias = { '7d': 7, '30d': 30, '90d': 90 }[periodo] ?? 30
  return { inicio: new Date(hoje.getTime() - dias * DIA_MS), fim: fimDoDia(hoje) }
}

const quando = (p) => new Date(p.data_publicacao ?? p.criado_em)
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

export default function Relatorio({ demo, usuario }) {
  const [publicacoes, setPublicacoes] = useState(null)
  const [erro, setErro] = useState('')
  const [periodo, setPeriodo] = useState('30d')
  const [dataInicio, setDataInicio] = useState(isoDia(new Date(Date.now() - 30 * DIA_MS)))
  const [dataFim, setDataFim] = useState(isoDia(new Date()))

  useEffect(() => {
    listarTributario({ demo }).then((r) => {
      if (!r.ok) {
        setErro(r.erro)
        setPublicacoes([])
        return
      }
      setPublicacoes(r.publicacoes)
    })
  }, [demo])

  const { inicio, fim } = intervalo(periodo, dataInicio, dataFim)

  const dados = useMemo(() => {
    if (!publicacoes) return null
    const doPeriodo = publicacoes
      .filter((p) => {
        const d = quando(p)
        return d >= inicio && d <= fim
      })
      .sort((a, b) => quando(b) - quando(a))

    const contar = (filtro) => doPeriodo.filter(filtro).length
    const bancos = new Set(doPeriodo.filter((p) => NOMES_BANCOS.includes(p.banco)).map((p) => p.banco))

    const porBanco = [...new Set(doPeriodo.map((p) => p.banco))]
      .map((banco) => {
        const lista = doPeriodo.filter((p) => p.banco === banco)
        return {
          banco,
          total: lista.length,
          site: lista.filter((p) => p.origem === 'Site do banco').length,
          split: lista.filter((p) => (p.assuntos ?? []).includes('Split Payment')).length,
          reforma: lista.filter((p) => (p.assuntos ?? []).includes('Reforma Tributária')).length,
          alta: lista.filter((p) => p.prioridade === 'Alta').length,
          ultima: lista[0] ? quando(lista[0]) : null,
        }
      })
      .sort((a, b) => b.alta - a.alta || b.total - a.total || a.banco.localeCompare(b.banco, 'pt-BR'))

    return {
      doPeriodo,
      total: doPeriodo.length,
      alta: contar((p) => p.prioridade === 'Alta'),
      altaAberta: contar((p) => p.prioridade === 'Alta' && STATUS_ABERTOS.includes(p.status)),
      site: contar((p) => p.origem === 'Site do banco'),
      split: contar((p) => (p.assuntos ?? []).includes('Split Payment')),
      reforma: contar((p) => (p.assuntos ?? []).includes('Reforma Tributária')),
      tratadas: contar((p) => TRATADAS.includes(p.status)),
      pendentes: contar((p) => p.status === 'Novo' || p.status === 'Em análise'),
      bancos,
      porBanco,
      sinais: Object.keys(SINAIS).map((s) => [s, contar((p) => (p.sinais ?? []).includes(s))]),
      status: STATUS_TRIB.map((s) => [s, contar((p) => p.status === s)]),
      destaques: doPeriodo.filter((p) => p.prioridade === 'Alta'),
      acoes: doPeriodo.filter((p) => (p.acao ?? '').trim() !== ''),
      semPublicacao: NOMES_BANCOS.filter((b) => !bancos.has(b)),
    }
    // inicio/fim mudam junto com periodo e datas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicacoes, periodo, dataInicio, dataFim])

  if (!dados) return <p className="pendente">Montando o relatório…</p>

  const rotuloPeriodo = `${dataCurta(inicio.toISOString())} a ${dataCurta(fim.toISOString())}`
  const maiorSinal = Math.max(1, ...dados.sinais.map(([, n]) => n))
  const maiorStatus = Math.max(1, ...dados.status.map(([, n]) => n))

  function exportar() {
    baixarCsv({
      nomeArquivo: `relatorio-split-reforma-${dataParaArquivo()}.csv`,
      cabecalhos: ['Banco', 'Título', 'Assuntos', 'Origem', 'Prioridade', 'Sinais', 'Status', 'Responsável', 'Ação', 'Publicado em', 'Link'],
      linhas: dados.doPeriodo.map((p) => [
        p.banco,
        p.titulo,
        (p.assuntos ?? []).join(', '),
        p.origem,
        p.prioridade,
        (p.sinais ?? []).join(', '),
        p.status,
        p.responsavel,
        p.acao,
        dataCurta(p.data_publicacao),
        p.url,
      ]),
    })
  }

  return (
    <div className="dashboard relatorio">
      <div className="dash-topo">
        <div>
          <h2 className="relatorio-titulo">Relatório Split Payment e Reforma Tributária</h2>
          <span className="dash-legenda">
            Período: {rotuloPeriodo} · gerado em {new Date().toLocaleString('pt-BR')}
            {usuario ? ` por ${usuario}` : ''}
          </span>
        </div>
        <div className="dash-controles">
          <select className="filtro-select" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          {periodo === 'personalizado' && (
            <span className="filtro-datas">
              <input type="date" className="filtro-select" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              <span className="filtro-datas-ate">até</span>
              <input type="date" className="filtro-select" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </span>
          )}
          <button className="usuario-btn" onClick={exportar} disabled={dados.total === 0}>
            ⬇️ CSV
          </button>
          <button className="primario" onClick={() => window.print()}>
            🖨️ Imprimir / PDF
          </button>
        </div>
      </div>

      {erro && <div className="banner erro">⚠️ {erro}</div>}

      <section className="dash-cartao">
        <h3>Resumo executivo</h3>
        {dados.total === 0 ? (
          <p className="relatorio-texto">Nenhuma publicação dos bancos acompanhados neste período.</p>
        ) : (
          <ul className="relatorio-resumo">
            <li>
              {plural(dados.total, 'publicação encontrada', 'publicações encontradas')} de{' '}
              {plural(dados.bancos.size, 'banco', 'bancos')} da lista Finnet ({dados.bancos.size} de {NOMES_BANCOS.length}).
            </li>
            <li>
              {dados.split} sobre split payment e {dados.reforma} sobre reforma tributária;{' '}
              {plural(dados.site, 'veio', 'vieram')} dos sites oficiais dos próprios bancos.
            </li>
            <li>
              {plural(dados.alta, 'publicação de prioridade Alta', 'publicações de prioridade Alta')}
              {dados.alta > 0 ? `, das quais ${dados.altaAberta} ainda em aberto.` : '.'}
            </li>
            <li>
              Tratativa: {dados.tratadas} com ação definida, concluídas ou sem impacto; {dados.pendentes} aguardando análise.
            </li>
            {dados.porBanco[0] && (
              <li>
                Banco mais ativo no período: {dados.porBanco[0].banco} ({plural(dados.porBanco[0].total, 'publicação', 'publicações')}).
              </li>
            )}
          </ul>
        )}
      </section>

      <div className="cockpit">
        <div className="tile">
          <span className="tile-k">🧾 Publicações</span>
          <span className="tile-v">{dados.total}</span>
          <span className="tile-d">no período</span>
        </div>
        <div className="tile">
          <span className="tile-k">🔴 Prioridade Alta</span>
          <span className={`tile-v${dados.altaAberta > 0 ? ' vermelho' : ''}`}>
            {dados.alta}
            <small> · {dados.altaAberta} em aberto</small>
          </span>
          <span className="tile-d">split payment com impacto técnico</span>
        </div>
        <div className="tile">
          <span className="tile-k">🏦 Dos sites dos bancos</span>
          <span className="tile-v">{dados.site}</span>
          <span className="tile-d">publicado pelo próprio banco</span>
        </div>
        <div className="tile">
          <span className="tile-k">✔ Tratadas</span>
          <span className="tile-v verde">
            {dados.tratadas}
            <small> / {dados.total}</small>
          </span>
          <span className="tile-d">ação definida, concluída ou sem impacto</span>
        </div>
      </div>

      <section className="dash-cartao">
        <h3>
          Destaques de prioridade Alta <small>{dados.destaques.length}</small>
        </h3>
        {dados.destaques.length === 0 ? (
          <p className="dash-vazio">Nenhuma publicação de prioridade Alta no período.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Banco</th>
                <th>Publicação</th>
                <th>Data</th>
                <th>Status</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {dados.destaques.map((p) => (
                <tr key={p.id}>
                  <td>{p.banco}</td>
                  <td>
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {p.titulo}
                    </a>
                  </td>
                  <td>{dataCurta(p.data_publicacao)}</td>
                  <td>
                    <span className={`veredito ${COR_STATUS[p.status] || 'azul'}`}>{p.status}</span>
                  </td>
                  <td>{p.responsavel || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="dash-grade">
        <section className="dash-cartao">
          <h3>Sinais de ação</h3>
          {dados.sinais.map(([sinal, n]) => (
            <div key={sinal} className="dash-barra">
              <span className="dash-barra-rotulo" title={sinal}>
                {sinal}
              </span>
              <div className="dash-barra-trilho">
                <div className="dash-barra-fill" style={{ width: `${(n / maiorSinal) * 100}%` }} />
              </div>
              <span className="dash-barra-num">{n}</span>
            </div>
          ))}
        </section>
        <section className="dash-cartao">
          <h3>Situação das tratativas</h3>
          {dados.status.map(([status, n]) => (
            <div key={status} className="dash-barra">
              <span className="dash-barra-rotulo">{status}</span>
              <div className="dash-barra-trilho">
                <div className={`dash-barra-fill ${COR_STATUS[status]}`} style={{ width: `${(n / maiorStatus) * 100}%` }} />
              </div>
              <span className="dash-barra-num">{n}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="dash-cartao">
        <h3>
          Publicações por banco <small>{dados.porBanco.length} com publicação no período</small>
        </h3>
        {dados.porBanco.length === 0 ? (
          <p className="dash-vazio">Nenhum banco publicou no período.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Banco</th>
                <th>Total</th>
                <th>Site do banco</th>
                <th>Split payment</th>
                <th>Reforma</th>
                <th>Alta</th>
                <th>Última</th>
              </tr>
            </thead>
            <tbody>
              {dados.porBanco.map((l) => (
                <tr key={l.banco}>
                  <td>{l.banco}</td>
                  <td>{l.total}</td>
                  <td>{l.site}</td>
                  <td>{l.split}</td>
                  <td>{l.reforma}</td>
                  <td>{l.alta > 0 ? <b>{l.alta}</b> : 0}</td>
                  <td>{l.ultima ? dataCurta(l.ultima.toISOString()) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {dados.semPublicacao.length > 0 && (
          <p className="dash-legenda relatorio-sem">
            <b>Sem publicação no período ({dados.semPublicacao.length}):</b> {dados.semPublicacao.join(', ')}.
          </p>
        )}
      </section>

      <section className="dash-cartao">
        <h3>
          Ações registradas pelo time <small>{dados.acoes.length}</small>
        </h3>
        {dados.acoes.length === 0 ? (
          <p className="dash-vazio">Nenhuma ação registrada para as publicações do período.</p>
        ) : (
          <div className="relatorio-acoes">
            {dados.acoes.map((p) => (
              <div key={p.id} className="relatorio-acao">
                <div>
                  <b>{p.banco}</b>: {p.titulo}
                </div>
                <div className="dash-legenda">
                  {p.status}
                  {p.responsavel ? ` · responsável ${p.responsavel}` : ''}
                </div>
                <pre>{p.acao}</pre>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
