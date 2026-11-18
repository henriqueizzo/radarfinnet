// 🧾 Split & Reforma — vertical Split Payment & Reforma Tributária.
// Todo dia o robô (coletor/coletar-tributario.js) busca o que os bancos
// integrados à Finnet publicam sobre split payment e reforma (nos sites
// deles e na imprensa) e as documentações de layout que cada banco
// mantém no próprio site; classifica e grava. Aqui o time trata cada publicação:
// Novo → Em análise → Ação definida → Concluído (ou Sem impacto).
import { useEffect, useMemo, useState } from 'react'
import { listarTributario, tratarPublicacao } from '../lib/api.js'
import {
  NOMES_BANCOS,
  ASSUNTOS_TRIB,
  ORIGENS_TRIB,
  PRIORIDADES_TRIB,
  STATUS_TRIB,
  STATUS_ABERTOS,
  COR_PRIORIDADE,
  ICONE_ASSUNTO,
  MOTIVO_PRIORIDADE,
  sugerirAcao,
} from '../lib/tributario.js'
import { dataCompleta, dataCurta, dataParaArquivo, semAcentos, tempoRelativo } from '../lib/util.js'
import { baixarCsv } from '../lib/csv.js'
import { useAvisos } from '../componentes/Avisos.jsx'

const FILTROS_VAZIOS = {
  busca: '',
  banco: '',
  assunto: '',
  origem: '',
  prioridade: '',
  status: 'abertos',
  ordem: 'prioridade',
}

const PESO_PRIORIDADE = { Alta: 0, Média: 1, Baixa: 2 }
const DIA_MS = 24 * 60 * 60 * 1000

function ordenar(lista, ordem) {
  const data = (p) => new Date(p.data_publicacao ?? p.criado_em).getTime() || 0
  return [...lista].sort((a, b) => {
    if (ordem === 'prioridade') {
      const diferenca = PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade]
      if (diferenca !== 0) return diferenca
    }
    return data(b) - data(a)
  })
}

export default function Tributario({ usuario, demo }) {
  const { toast } = useAvisos()
  const [publicacoes, setPublicacoes] = useState(null) // null = carregando
  const [erro, setErro] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS)
  const [visao, setVisao] = useState('lista') // 'lista' | 'cobertura'
  const [emTratativa, setEmTratativa] = useState(null)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const r = await listarTributario({ demo })
    if (!r.ok) {
      setErro(r.erro)
      setPublicacoes((atuais) => atuais ?? [])
      return
    }
    setErro('')
    setPublicacoes(r.publicacoes)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visiveis = useMemo(() => {
    if (!publicacoes) return []
    const busca = semAcentos(filtros.busca.trim())
    return ordenar(
      publicacoes.filter((p) => {
        if (filtros.banco && p.banco !== filtros.banco) return false
        if (filtros.assunto && !(p.assuntos ?? []).includes(filtros.assunto)) return false
        if (filtros.origem && p.origem !== filtros.origem) return false
        if (filtros.prioridade && p.prioridade !== filtros.prioridade) return false
        if (filtros.status === 'abertos' && !STATUS_ABERTOS.includes(p.status)) return false
        if (filtros.status && filtros.status !== 'abertos' && filtros.status !== 'todos' && p.status !== filtros.status) return false
        if (busca && !semAcentos(`${p.titulo} ${p.banco} ${p.veiculo} ${p.acao}`).includes(busca)) return false
        return true
      }),
      filtros.ordem,
    )
  }, [publicacoes, filtros])

  if (publicacoes === null) return <p className="pendente">Carregando as publicações dos bancos…</p>

  const agora = Date.now()
  const novos = publicacoes.filter((p) => p.status === 'Novo')
  const altaAberta = publicacoes.filter((p) => p.prioridade === 'Alta' && STATUS_ABERTOS.includes(p.status))
  const doBanco30d = publicacoes.filter(
    (p) => p.origem === 'Site do banco' && agora - new Date(p.data_publicacao ?? p.criado_em).getTime() <= 30 * DIA_MS,
  )
  const bancosComPublicacao = new Set(publicacoes.map((p) => p.banco).filter((b) => NOMES_BANCOS.includes(b)))
  const bancosDaLista = [...new Set(publicacoes.map((p) => p.banco))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const mudar = (parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))

  async function salvar(publicacao, campos, mensagem) {
    setSalvando(true)
    const r = await tratarPublicacao({ demo, publicacao, campos, usuario })
    setSalvando(false)
    if (!r.ok) {
      toast(r.erro, 'erro')
      return false
    }
    const atualizada = r.salva ?? r.salvaDemo
    setPublicacoes((atuais) => atuais.map((p) => (p.id === publicacao.id ? atualizada : p)))
    if (mensagem) toast(mensagem, 'ok')
    return true
  }

  function exportar() {
    baixarCsv({
      nomeArquivo: `split-reforma-${dataParaArquivo()}.csv`,
      cabecalhos: ['Banco', 'Título', 'Assuntos', 'Origem', 'Veículo', 'Prioridade', 'Sinais', 'Status', 'Responsável', 'Ação', 'Publicado em', 'Link'],
      linhas: visiveis.map((p) => [
        p.banco,
        p.titulo,
        (p.assuntos ?? []).join(', '),
        p.origem,
        p.veiculo,
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

  const filtrando = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VAZIOS)

  return (
    <>
      <div className="cockpit">
        <button className="tile tile-botao" onClick={() => mudar({ ...FILTROS_VAZIOS, status: 'Novo' })}>
          <span className="tile-k">🆕 Novos</span>
          <span className="tile-v">{novos.length}</span>
          <span className="tile-d">ainda ninguém olhou</span>
        </button>
        <button className="tile tile-botao" onClick={() => mudar({ ...FILTROS_VAZIOS, prioridade: 'Alta' })}>
          <span className="tile-k">🔴 Alta em aberto</span>
          <span className={`tile-v${altaAberta.length > 0 ? ' vermelho' : ''}`}>{altaAberta.length}</span>
          <span className="tile-d">split payment com impacto técnico</span>
        </button>
        <button className="tile tile-botao" onClick={() => mudar({ ...FILTROS_VAZIOS, origem: 'Site do banco', status: 'todos', ordem: 'recentes' })}>
          <span className="tile-k">🏦 Dos sites dos bancos</span>
          <span className="tile-v">{doBanco30d.length}</span>
          <span className="tile-d">publicados nos últimos 30 dias</span>
        </button>
        <button className="tile tile-botao" onClick={() => setVisao('cobertura')}>
          <span className="tile-k">📊 Bancos com publicação</span>
          <span className="tile-v">
            {bancosComPublicacao.size}
            <small> / {NOMES_BANCOS.length}</small>
          </span>
          <span className="tile-d">da lista de bancos integrados</span>
        </button>
      </div>

      {erro && <div className="banner erro">⚠️ {erro}</div>}

      <div className="barra-busca">
        <div className="alternador">
          <button className={visao === 'lista' ? 'ativo' : ''} onClick={() => setVisao('lista')}>
            🧾 Publicações
          </button>
          <button className={visao === 'cobertura' ? 'ativo' : ''} onClick={() => setVisao('cobertura')}>
            🏦 Cobertura por banco
          </button>
        </div>
        {visao === 'lista' && (
          <>
            <div className="campo-busca">
              <svg className="campo-busca-lupa" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por título, banco ou ação…"
                value={filtros.busca}
                onChange={(e) => mudar({ busca: e.target.value })}
              />
              {filtros.busca && (
                <button className="campo-busca-limpar" aria-label="Limpar busca" onClick={() => mudar({ busca: '' })}>
                  ×
                </button>
              )}
            </div>
            <button className="usuario-btn" onClick={exportar} disabled={visiveis.length === 0}>
              ⬇️ Exportar CSV
            </button>
          </>
        )}
      </div>

      {visao === 'lista' && (
        <>
          <div className="barra-busca">
            <select className="filtro-select" value={filtros.banco} onChange={(e) => mudar({ banco: e.target.value })}>
              <option value="">Todos os bancos</option>
              {bancosDaLista.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            <select className="filtro-select" value={filtros.assunto} onChange={(e) => mudar({ assunto: e.target.value })}>
              <option value="">Todos os assuntos</option>
              {ASSUNTOS_TRIB.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <select className="filtro-select" value={filtros.origem} onChange={(e) => mudar({ origem: e.target.value })}>
              <option value="">Site do banco + imprensa</option>
              {ORIGENS_TRIB.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <select className="filtro-select" value={filtros.prioridade} onChange={(e) => mudar({ prioridade: e.target.value })}>
              <option value="">Qualquer prioridade</option>
              {PRIORIDADES_TRIB.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select className="filtro-select" value={filtros.status} onChange={(e) => mudar({ status: e.target.value })}>
              <option value="abertos">Em aberto (novo, em análise, ação definida)</option>
              {STATUS_TRIB.map((s) => (
                <option key={s}>{s}</option>
              ))}
              <option value="todos">Todos, inclusive histórico</option>
            </select>
            <select className="filtro-select" value={filtros.ordem} onChange={(e) => mudar({ ordem: e.target.value })}>
              <option value="prioridade">Por prioridade</option>
              <option value="recentes">Mais recentes primeiro</option>
            </select>
            {filtrando && (
              <button className="usuario-btn" onClick={() => setFiltros(FILTROS_VAZIOS)}>
                Limpar filtros
              </button>
            )}
            <span className="busca-contagem">
              {visiveis.length} de {publicacoes.length}
            </span>
          </div>

          {visiveis.length === 0 && (
            <p className="dash-vazio">
              {publicacoes.length === 0
                ? 'Nenhuma publicação ainda. O robô roda todo dia de manhã e preenche esta lista.'
                : 'Nada com esses filtros. Experimente "Todos, inclusive histórico" no status.'}
            </p>
          )}

          <div className="feed-lista">
            {visiveis.map((p) => (
              <CartaoPublicacao
                key={p.id}
                p={p}
                salvando={salvando}
                aoMudarStatus={(status) => salvar(p, { status }, `Status: ${status}`)}
                aoTratar={() => setEmTratativa({ ...p, acao: p.acao || '' })}
              />
            ))}
          </div>
        </>
      )}

      {visao === 'cobertura' && (
        <Cobertura
          publicacoes={publicacoes}
          aoVerBanco={(banco) => {
            setFiltros({ ...FILTROS_VAZIOS, banco, status: 'todos', ordem: 'recentes' })
            setVisao('lista')
          }}
        />
      )}

      {emTratativa && (
        <JanelaTratativa
          dados={emTratativa}
          setDados={setEmTratativa}
          salvando={salvando}
          aoFechar={() => setEmTratativa(null)}
          aoSalvar={async (evento) => {
            evento.preventDefault()
            const original = publicacoes.find((p) => p.id === emTratativa.id)
            const ok = await salvar(
              original,
              { status: emTratativa.status, responsavel: emTratativa.responsavel.trim(), acao: emTratativa.acao },
              'Tratativa salva.',
            )
            if (ok) setEmTratativa(null)
          }}
        />
      )}
    </>
  )
}

function CartaoPublicacao({ p, salvando, aoMudarStatus, aoTratar }) {
  const faixa =
    p.status === 'Concluído' || p.status === 'Sem impacto'
      ? 'faixa-verde'
      : p.prioridade === 'Alta'
        ? 'faixa-vermelho'
        : p.prioridade === 'Média'
          ? 'faixa-amarelo'
          : 'faixa-azul'

  return (
    <article className={`cartao tributario-cartao ${faixa}`}>
      <div className="cartao-topo">
        <a className="cartao-titulo" href={p.url} target="_blank" rel="noreferrer" title={p.titulo}>
          {p.titulo}
        </a>
        <span className="veredito azul">{p.banco}</span>
      </div>

      <div className="temas-chips">
        <span className={`veredito ${COR_PRIORIDADE[p.prioridade]}`} title={MOTIVO_PRIORIDADE[p.prioridade]}>
          Prioridade {p.prioridade}
        </span>
        {(p.assuntos ?? []).map((a) => (
          <span key={a} className="veredito azul">
            {ICONE_ASSUNTO[a] ?? '🧾'} {a}
          </span>
        ))}
        <span className={`veredito ${p.origem === 'Site do banco' ? 'verde' : 'cinza'}`}>
          {p.origem === 'Site do banco' ? '🏦 Site do banco' : '📰 Imprensa'}
        </span>
        {(p.sinais ?? []).map((s) => (
          <span key={s} className="veredito cinza">
            ⚑ {s}
          </span>
        ))}
      </div>

      {(p.responsavel || p.acao) && (
        <div className="comunicacao-detalhes">
          {p.responsavel && (
            <span>
              <b>Responsável:</b> {p.responsavel}
            </span>
          )}
          {p.acao && (
            <span className="tributario-acao">
              <b>Ação:</b> {p.acao}
            </span>
          )}
        </div>
      )}

      <div className="cartao-meta">
        <span title={dataCompleta(p.data_publicacao)}>
          {dataCurta(p.data_publicacao)} ({tempoRelativo(p.data_publicacao)})
        </span>
        <span>{p.veiculo || '—'}</span>
      </div>

      <div className="acoes">
        <select
          className="filtro-select filtro-select-mini"
          value={p.status}
          disabled={salvando}
          onChange={(e) => aoMudarStatus(e.target.value)}
          aria-label="Status da tratativa"
        >
          {STATUS_TRIB.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button onClick={aoTratar}>📋 Tratar</button>
        <a href={p.url} target="_blank" rel="noreferrer">
          🔗 Abrir publicação
        </a>
        {STATUS_ABERTOS.includes(p.status) && (
          <button disabled={salvando} onClick={() => aoMudarStatus('Sem impacto')}>
            ✔ Sem impacto
          </button>
        )}
      </div>
    </article>
  )
}

// Quais bancos da lista publicaram algo, quando foi a última vez e quanto
// está em aberto. Bancos sem nada aparecem no fim, para ninguém achar que
// foram esquecidos: o robô procura por eles todo dia.
function Cobertura({ publicacoes, aoVerBanco }) {
  const linhas = NOMES_BANCOS.map((banco) => {
    const doBanco = publicacoes.filter((p) => p.banco === banco)
    const ultima = doBanco.reduce((maior, p) => (p.data_publicacao > maior ? p.data_publicacao : maior), '')
    return {
      banco,
      total: doBanco.length,
      site: doBanco.filter((p) => p.origem === 'Site do banco').length,
      split: doBanco.filter((p) => (p.assuntos ?? []).includes('Split Payment')).length,
      layout: doBanco.filter((p) => (p.assuntos ?? []).includes('Layout/Documentação')).length,
      abertos: doBanco.filter((p) => STATUS_ABERTOS.includes(p.status)).length,
      ultima,
    }
  }).sort((a, b) => (b.ultima || '').localeCompare(a.ultima || '') || a.banco.localeCompare(b.banco, 'pt-BR'))

  return (
    <>
      <p className="dash-legenda">
        Todo dia o robô busca cada um dos {NOMES_BANCOS.length} bancos da lista nos sites oficiais e na imprensa. Clique
        num banco para ver as publicações dele.
      </p>
      <table className="tabela">
        <thead>
          <tr>
            <th>Banco</th>
            <th>Publicações</th>
            <th>No site do banco</th>
            <th>Sobre split payment</th>
            <th>Documentação de layout</th>
            <th>Em aberto</th>
            <th>Última publicação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.banco}>
              <td>
                {l.total > 0 ? (
                  <button className="link-botao" onClick={() => aoVerBanco(l.banco)}>
                    {l.banco}
                  </button>
                ) : (
                  l.banco
                )}
              </td>
              <td>{l.total}</td>
              <td>{l.site}</td>
              <td>{l.split}</td>
              <td>{l.layout}</td>
              <td>{l.abertos > 0 ? <b>{l.abertos}</b> : 0}</td>
              <td>{l.ultima ? dataCurta(l.ultima) : 'nada encontrado até agora'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function JanelaTratativa({ dados, setDados, salvando, aoSalvar, aoFechar }) {
  const mudar = (parcial) => setDados((atuais) => ({ ...atuais, ...parcial }))

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="janela" onClick={(e) => e.stopPropagation()}>
        <div className="janela-cabecalho">
          <strong>📋 Tratar publicação</strong>
          <div className="janela-botoes">
            <button aria-label="Fechar" onClick={aoFechar}>
              ✕
            </button>
          </div>
        </div>
        <div className="janela-corpo">
          <p className="tributario-janela-titulo">
            <b>{dados.banco}</b>:{' '}
            <a href={dados.url} target="_blank" rel="noreferrer">
              {dados.titulo}
            </a>
          </p>
          <p className="dash-legenda">
            Prioridade {dados.prioridade}: {MOTIVO_PRIORIDADE[dados.prioridade]}.
          </p>
          <form className="formulario" onSubmit={aoSalvar}>
            <div className="formulario-linha">
              <label>
                Status
                <select value={dados.status} onChange={(e) => mudar({ status: e.target.value })}>
                  {STATUS_TRIB.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Responsável
                <input
                  type="text"
                  value={dados.responsavel}
                  onChange={(e) => mudar({ responsavel: e.target.value })}
                  placeholder="Quem cuida desta publicação"
                />
              </label>
            </div>
            <label>
              Ação / conclusão
              <textarea
                rows={7}
                value={dados.acao}
                onChange={(e) => mudar({ acao: e.target.value })}
                placeholder="Clique em 💡 Sugerir ação para gerar um ponto de partida a partir dos sinais da publicação."
              />
            </label>
            <div className="janela-rodape">
              <button type="button" className="usuario-btn" onClick={() => mudar({ acao: sugerirAcao(dados) })}>
                💡 Sugerir ação
              </button>
              <button type="submit" className="primario" disabled={salvando}>
                {salvando ? '⏳ Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
