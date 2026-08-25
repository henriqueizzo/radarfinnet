import { Fragment, useEffect, useState } from 'react'
import {
  enviarNoticiaAoRadar,
  arquivarNoticia,
  buscarTodasNoticias,
  FILTROS_INICIAIS,
} from '../lib/api.js'
import {
  FONTES,
  CATEGORIAS,
  TEMAS,
  PERIODOS,
  ORDENS,
  GRUPOS_PRIORIDADE,
  prioridadeDaCategoria,
} from '../lib/catalogos.js'
import { baixarCsv } from '../lib/csv.js'
import {
  tempoRelativo,
  dataCompleta,
  dataCurta,
  temasDaNoticia,
  dataParaArquivo,
  ehInforme,
} from '../lib/util.js'
import { useAvisos } from '../componentes/Avisos.jsx'
import ResumoNoticia from '../componentes/ResumoNoticia.jsx'

// Faixa lateral: âmbar = normativo (pede atenção), azul = comunicado/consulta/release
function faixaDaNoticia(noticia) {
  if (noticia.categoria === 'Normativo') return 'faixa-amarelo'
  if (['Comunicado', 'Consulta Pública', 'Release'].includes(noticia.categoria)) return 'faixa-azul'
  return ''
}

// O feed recebe as notícias JÁ filtradas e paginadas (App.jsx + lib/api.js);
// aqui só ficam os controles dos filtros e a lista.
export default function Feed({
  noticias,
  total,
  filtros,
  aoMudarFiltros,
  aoCarregarMais,
  carregandoMais,
  aoRecarregar,
  indicadores,
  radar,
  aoAtualizar,
  usuario,
  demo,
  aoEnviarDemo,
  ordemAplicada,
  avisoOrdem,
}) {
  const { toast } = useAvisos()
  const [buscaDigitada, setBuscaDigitada] = useState(filtros.busca)
  const [enviandoId, setEnviandoId] = useState(null)
  const [arquivandoId, setArquivandoId] = useState(null)
  const [exportando, setExportando] = useState(false)

  // A busca por texto espera a digitação parar (0,4 s) antes de ir ao servidor
  useEffect(() => {
    if (buscaDigitada === filtros.busca) return
    const espera = setTimeout(() => aoMudarFiltros({ ...filtros, busca: buscaDigitada }), 400)
    return () => clearTimeout(espera)
  }, [buscaDigitada, filtros, aoMudarFiltros])

  if (noticias === null) return <p className="pendente">Carregando o feed…</p>

  const mudar = (parcial) => aoMudarFiltros({ ...filtros, ...parcial })
  const limparFiltros = () => {
    setBuscaDigitada('')
    aoMudarFiltros(FILTROS_INICIAIS)
  }
  const temFiltro = Boolean(
    filtros.busca ||
      filtros.fonte ||
      filtros.categoria ||
      filtros.tema ||
      filtros.periodo ||
      filtros.arquivadas ||
      filtros.ordem,
  )

  // "Só novidades" = os últimos 7 dias (a mesma janela do indicador do cockpit)
  const soNovidades = filtros.periodo === '7d'
  const alternarNovidades = () =>
    mudar({ periodo: soNovidades ? '' : '7d', dataInicio: '', dataFim: '' })

  const idsNoRadar = new Set((radar ?? []).map((item) => item.noticia_id))
  const emAndamento = (radar ?? []).filter((i) => i.status !== 'Entregue').length

  async function enviarAoRadar(noticia) {
    setEnviandoId(noticia.id)
    const r = await enviarNoticiaAoRadar({ demo, noticia, usuario })
    if (!r.ok) {
      toast(`Não consegui enviar ao Radar: ${r.erro}`, 'erro')
    } else {
      if (r.itemDemo) aoEnviarDemo(r.itemDemo) // no modo demonstração, só muda na tela
      await aoAtualizar()
      toast('Enviado ao Radar.', 'ok')
    }
    setEnviandoId(null)
  }

  // Arquivar tira a notícia do feed padrão (restaurar traz de volta).
  // No modo demonstração muda só em memória; no banco sem a migração,
  // a api devolve uma mensagem explicando o que aplicar.
  async function definirArquivada(noticia, arquivada) {
    setArquivandoId(noticia.id)
    const r = await arquivarNoticia({ demo, noticia, arquivada, usuario })
    setArquivandoId(null)
    if (!r.ok) {
      toast(r.erro, 'erro')
      return
    }
    toast(arquivada ? 'Notícia arquivada — saiu do feed padrão.' : 'Notícia restaurada ao feed.', 'ok')
    aoRecarregar()
  }

  // Exporta TUDO que casa com o filtro atual (não só a página na tela)
  async function exportarCsv() {
    setExportando(true)
    const r = await buscarTodasNoticias({ demo, filtros })
    setExportando(false)
    if (!r.ok) {
      toast(`Não consegui exportar: ${r.erro}`, 'erro')
      return
    }
    baixarCsv({
      nomeArquivo: `feed-radar-regulatorio-${dataParaArquivo()}.csv`,
      cabecalhos: ['Título', 'Resumo', 'Fonte', 'Categoria', 'Temas', 'Publicada em', 'Arquivada', 'Link'],
      linhas: r.noticias.map((n) => [
        n.titulo,
        n.resumo ?? '',
        n.fonte ?? '',
        n.categoria ?? '',
        temasDaNoticia(n).todos.join(', '),
        dataCompleta(n.data_publicacao),
        n.descartada ? 'Sim' : 'Não',
        n.url ?? '',
      ]),
    })
    toast(`CSV baixado com ${r.noticias.length} notícia(s) — abre direto no Excel.`, 'ok')
  }

  return (
    <>
      <div className="cockpit">
        <button
          type="button"
          className={`tile tile-botao ${soNovidades ? 'tile-ativo' : ''}`}
          onClick={alternarNovidades}
          title={
            soNovidades
              ? 'Mostrando só as novidades — clique para ver tudo'
              : 'Clique para ver só as novidades (últimos 7 dias)'
          }
        >
          <span className="tile-k">
            <span className="led" /> Novidades (7 dias)
          </span>
          <span className="tile-v">{indicadores ? indicadores.novidades7d : '…'}</span>
          <span className="tile-d" title={dataCompleta(indicadores?.ultimaColeta)}>
            última coleta {indicadores ? tempoRelativo(indicadores.ultimaColeta) : '…'}
          </span>
        </button>
        <div className="tile">
          <span className="tile-k">Normativos (30 dias)</span>
          <span className="tile-v">{indicadores ? indicadores.normativos30d : '…'}</span>
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
            value={buscaDigitada}
            onChange={(e) => setBuscaDigitada(e.target.value)}
          />
          {buscaDigitada && (
            <button
              className="campo-busca-limpar"
              aria-label="Limpar busca"
              onClick={() => {
                setBuscaDigitada('')
                mudar({ busca: '' })
              }}
            >
              ×
            </button>
          )}
        </div>
        <select className="filtro-select" value={filtros.fonte} onChange={(e) => mudar({ fonte: e.target.value })}>
          <option value="">Todas as fontes</option>
          {FONTES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select
          className="filtro-select"
          value={filtros.categoria}
          onChange={(e) => mudar({ categoria: e.target.value })}
        >
          <option value="">Todos os tipos</option>
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="filtro-select" value={filtros.tema} onChange={(e) => mudar({ tema: e.target.value })}>
          <option value="">Todos os temas</option>
          {TEMAS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          className="filtro-select"
          value={filtros.periodo}
          onChange={(e) => mudar({ periodo: e.target.value })}
        >
          {PERIODOS.map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
        <select
          className="filtro-select"
          value={filtros.ordem}
          onChange={(e) => mudar({ ordem: e.target.value })}
          title="Como ordenar a lista: pelas mais novas ou por prioridade regulatória"
        >
          {ORDENS.map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
        {filtros.periodo === 'personalizado' && (
          <span className="filtro-datas">
            <input
              type="date"
              className="filtro-select"
              aria-label="Data inicial"
              value={filtros.dataInicio}
              onChange={(e) => mudar({ dataInicio: e.target.value })}
            />
            <span className="filtro-datas-ate">até</span>
            <input
              type="date"
              className="filtro-select"
              aria-label="Data final"
              value={filtros.dataFim}
              onChange={(e) => mudar({ dataFim: e.target.value })}
            />
          </span>
        )}
        <label className="filtro-check" title="Mostra só o que chegou nos últimos 7 dias">
          <input type="checkbox" checked={soNovidades} onChange={alternarNovidades} />
          ✨ Só novidades
        </label>
        <label className="filtro-check" title="Inclui as notícias que o time arquivou">
          <input
            type="checkbox"
            checked={filtros.arquivadas}
            onChange={(e) => mudar({ arquivadas: e.target.checked })}
          />
          Mostrar arquivadas
        </label>
        {(temFiltro || noticias.length < total) && (
          <span className="busca-contagem">
            {noticias.length} de {total}
          </span>
        )}
        {temFiltro && (
          <button className="usuario-btn" onClick={limparFiltros}>
            Limpar filtros
          </button>
        )}
        <button
          className="usuario-btn"
          onClick={exportarCsv}
          disabled={exportando || total === 0}
          title="Baixa um arquivo CSV (Excel) com TODAS as notícias do filtro atual"
        >
          {exportando ? '⏳ Exportando…' : '⬇️ Exportar CSV'}
        </button>
      </div>

      {total === 0 && !temFiltro && (
        <p className="dash-vazio">
          Nenhuma novidade ainda — rode o coletor (npm run coletar) para preencher o feed.
        </p>
      )}
      {total === 0 && temFiltro && (
        <p className="dash-vazio">Nada encontrado com esses filtros — tente limpar a busca.</p>
      )}

      {avisoOrdem && <div className="banner">⚠️ {avisoOrdem}</div>}

      <div className="feed-lista">
        {noticias.map((n, i) => {
          const temas = temasDaNoticia(n) // automáticos do coletor + manuais do time
          // Ordenado por prioridade, a lista ganha um cabeçalho a cada grupo novo
          const prioridade = prioridadeDaCategoria(n.categoria)
          const abreGrupo =
            ordemAplicada === 'prioridade' &&
            (i === 0 || prioridadeDaCategoria(noticias[i - 1].categoria) !== prioridade)
          return (
            <Fragment key={n.id}>
              {abreGrupo && <h3 className="feed-grupo">{GRUPOS_PRIORIDADE[prioridade]}</h3>}
            <article className={`cartao ${faixaDaNoticia(n)} ${n.descartada ? 'arquivada' : ''}`}>
              <div className="cartao-topo">
                <span className="cartao-titulo" title={n.titulo}>
                  {n.titulo}
                </span>
                {n.descartada && <span className="selo amarelo">🗄️ Arquivada</span>}
                <span className={`veredito ${n.categoria === 'Normativo' ? 'amarelo' : 'azul'}`}>
                  {n.categoria}
                </span>
              </div>
              <ResumoNoticia resumo={n.resumo} />
              {temas.todos.length > 0 && (
                <div className="temas-chips">
                  {temas.automaticos.map((t) => (
                    <span key={t} className="selo">
                      {t}
                    </span>
                  ))}
                  {temas.manuais.map((t) => (
                    <span key={t} className="selo selo-manual" title="Tema adicionado manualmente pelo time">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="cartao-meta">
                <span>{n.fonte}</span>
                <span title={dataCompleta(n.data_publicacao)}>
                  {ehInforme(n)
                    ? `📨 Data de envio: ${dataCurta(n.data_publicacao)}`
                    : tempoRelativo(n.data_publicacao)}
                </span>
              </div>
              <div className="acoes">
                <a href={n.url} target="_blank" rel="noreferrer">
                  Abrir na fonte ↗
                </a>
                {n.descartada ? (
                  <button
                    onClick={() => definirArquivada(n, false)}
                    disabled={arquivandoId === n.id}
                    title="Traz a notícia de volta ao feed padrão"
                  >
                    {arquivandoId === n.id ? '⏳ Restaurando…' : '♻️ Restaurar'}
                  </button>
                ) : (
                  <button
                    onClick={() => definirArquivada(n, true)}
                    disabled={arquivandoId === n.id}
                    title='Tira a notícia do feed padrão (reveja com "Mostrar arquivadas")'
                  >
                    {arquivandoId === n.id ? '⏳ Arquivando…' : '🗄️ Arquivar'}
                  </button>
                )}
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
            </Fragment>
          )
        })}
      </div>

      {noticias.length < total && (
        <div className="feed-paginacao">
          <button className="usuario-btn" onClick={aoCarregarMais} disabled={carregandoMais}>
            {carregandoMais ? '⏳ Carregando…' : '⬇️ Carregar mais'}
          </button>
          <span className="feed-paginacao-info">
            mostrando {noticias.length} de {total}
          </span>
        </div>
      )}
    </>
  )
}
