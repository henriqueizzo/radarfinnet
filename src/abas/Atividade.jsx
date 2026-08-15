// Log de atividades (só administradores) — portado do LicitaFinnet.
// Resumo de uso por usuário + detalhe com horas por dia e lista de eventos.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { rotuloTipo } from '../lib/atividade.js'
import { PERFIS_DEMO, ATIVIDADES_DEMO } from '../lib/demo.js'

const PERIODOS = [
  { dias: 7, rotulo: '7 dias' },
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
]

function tempoUso(min) {
  if (!min) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

function dataHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

// 'YYYY-MM-DD' → 'seg, 20/07/26'
function dataDia(dia) {
  const [a, m, d] = dia.split('-')
  const rotulo = new Date(Number(a), Number(m) - 1, Number(d)).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit',
  })
  return rotulo.replace('.', '')
}

// Dia local do evento, como 'YYYY-MM-DD'
function chaveDia(iso) {
  const d = new Date(iso)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

// Estimativa de tempo de uso: agrupa eventos com menos de 30 min de
// intervalo numa "sessão" e soma (duração da sessão + 5 min) de cada uma.
function estimarMinutos(temposMs) {
  if (temposMs.length === 0) return 0
  const ordenados = [...temposMs].sort((a, b) => a - b)
  let total = 0
  let inicio = ordenados[0]
  let anterior = ordenados[0]
  for (const t of ordenados.slice(1)) {
    if (t - anterior > 30 * 60000) {
      total += (anterior - inicio) / 60000 + 5
      inicio = t
    }
    anterior = t
  }
  total += (anterior - inicio) / 60000 + 5
  return Math.round(total)
}

// Monta o resumo por usuário a partir dos eventos brutos
function resumir(perfis, eventos) {
  return perfis
    .map((p) => {
      const meus = eventos.filter((e) => e.usuario_email === p.email)
      const porTipo = {}
      const porDia = {}
      const itens = new Set()
      for (const e of meus) {
        porTipo[e.tipo] = (porTipo[e.tipo] ?? 0) + 1
        const dia = chaveDia(e.criado_em)
        ;(porDia[dia] = porDia[dia] ?? []).push(new Date(e.criado_em).getTime())
        if (e.noticia_id) itens.add(e.noticia_id)
      }
      const usoPorDia = Object.entries(porDia)
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([dia, tempos]) => ({ dia, minutos: estimarMinutos(tempos), eventos: tempos.length }))
      return {
        ...p,
        total_eventos: meus.length,
        ultimo_acesso: meus[0]?.criado_em ?? null, // eventos chegam do mais novo pro mais velho
        itens_distintos: itens.size,
        eventos_por_tipo: porTipo,
        uso_por_dia: usoPorDia,
        tempo_uso_minutos: usoPorDia.reduce((soma, d) => soma + d.minutos, 0),
        eventos: meus,
      }
    })
    .sort((a, b) => b.total_eventos - a.total_eventos)
}

export default function Atividade({ demo }) {
  const [dias, setDias] = useState(30)
  const [usuarios, setUsuarios] = useState(null) // null = carregando
  const [selecionado, setSelecionado] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let ativo = true
    setUsuarios(null)
    setSelecionado(null)
    setMsg('')
    const corte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

    if (demo) {
      const eventos = ATIVIDADES_DEMO.filter((e) => e.criado_em >= corte)
      setUsuarios(resumir(PERFIS_DEMO, eventos))
      return
    }

    Promise.all([
      supabase.from('perfis').select('*').order('criado_em'),
      supabase
        .from('atividades')
        .select('*, noticia:noticias(titulo)')
        .gte('criado_em', corte)
        .order('criado_em', { ascending: false })
        .limit(2000),
    ]).then(([perfis, eventos]) => {
      if (!ativo) return
      if (perfis.error || eventos.error) {
        setUsuarios([])
        setMsg(`Falha ao carregar a atividade: ${(perfis.error ?? eventos.error).message}`)
        return
      }
      setUsuarios(resumir(perfis.data, eventos.data))
    })
    return () => { ativo = false }
  }, [dias, demo])

  function selecionar(u) {
    setSelecionado(selecionado?.id === u.id ? null : u)
  }

  return (
    <div className="atividade">
      {msg && <div className="banner erro">{msg}</div>}

      <div className="atividade-topo">
        <span className="atividade-legenda">
          Uso do sistema por usuário — eventos registrados nas ações principais
          (login, envios ao Radar, mudanças de status, edições). Clique num
          usuário para ver as horas de uso por dia e os eventos.
        </span>
        <div className="segmentado" role="tablist" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.dias} className={dias === p.dias ? 'ativo' : ''} onClick={() => setDias(p.dias)}>
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      <table className="tabela">
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Último acesso</th>
            <th>Eventos</th>
            <th>Itens do Radar</th>
            <th>Dias ativos</th>
            <th>Tempo de uso (est.)</th>
            <th>Atividade por tipo</th>
          </tr>
        </thead>
        <tbody>
          {(usuarios || []).map((u) => (
            <tr
              key={u.id}
              className={`clicavel linha ${selecionado?.id === u.id ? 'selecionada' : ''}`}
              onClick={() => selecionar(u)}
            >
              <td>
                {u.nome || u.email}
                {!u.ativo && <span className="veredito cinza atividade-pilula"> Desativado</span>}
                <div className="atividade-detalhe">{u.email}</div>
              </td>
              <td>{dataHora(u.ultimo_acesso)}</td>
              <td>{u.total_eventos}</td>
              <td>{u.itens_distintos}</td>
              <td>{u.uso_por_dia.length}</td>
              <td>{tempoUso(u.tempo_uso_minutos)}</td>
              <td>
                <div className="atividade-tipos">
                  {Object.entries(u.eventos_por_tipo)
                    .sort((a, b) => b[1] - a[1])
                    .map(([tipo, qtd]) => (
                      <span key={tipo} className="veredito azul atividade-pilula">
                        {rotuloTipo(tipo)} · {qtd}
                      </span>
                    ))}
                  {u.total_eventos === 0 && <span className="pendente">Sem atividade no período</span>}
                </div>
              </td>
            </tr>
          ))}
          {usuarios === null && (
            <tr>
              <td colSpan={7} className="pendente">Carregando…</td>
            </tr>
          )}
          {usuarios?.length === 0 && (
            <tr>
              <td colSpan={7} className="pendente">Nenhum usuário encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>

      {selecionado && (
        <div className="formulario atividade-eventos">
          <div className="atividade-topo">
            <strong>
              Atividade de {selecionado.nome || selecionado.email} — últimos {dias} dias
            </strong>
            <button className="usuario-btn" onClick={() => setSelecionado(null)}>Fechar</button>
          </div>

          <h4 className="atividade-subtitulo">Horas de uso por dia</h4>
          <table className="tabela atividade-uso-dia">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Tempo de uso (est.)</th>
                <th>Eventos</th>
              </tr>
            </thead>
            <tbody>
              {selecionado.uso_por_dia.map((d) => (
                <tr key={d.dia}>
                  <td>{dataDia(d.dia)}</td>
                  <td>{tempoUso(d.minutos)}</td>
                  <td>{d.eventos}</td>
                </tr>
              ))}
              {selecionado.uso_por_dia.length === 0 && (
                <tr>
                  <td colSpan={3} className="pendente">Sem uso registrado no período.</td>
                </tr>
              )}
            </tbody>
          </table>

          <h4 className="atividade-subtitulo">Eventos</h4>
          <table className="tabela">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>Item</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {selecionado.eventos.map((e) => (
                <tr key={e.id}>
                  <td>{dataHora(e.criado_em)}</td>
                  <td>
                    <span className="veredito azul atividade-pilula">{rotuloTipo(e.tipo)}</span>
                  </td>
                  <td>
                    {e.noticia?.titulo ? (
                      <div className="atividade-obj" title={e.noticia.titulo}>{e.noticia.titulo}</div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="atividade-detalhe">{e.detalhe || '—'}</td>
                </tr>
              ))}
              {selecionado.eventos.length === 0 && (
                <tr>
                  <td colSpan={4} className="pendente">Nenhum evento no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
