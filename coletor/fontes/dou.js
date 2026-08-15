// Diário Oficial da União — usado para capturar as RESOLUÇÕES DO COAF,
// que não têm feed próprio (elas sempre saem na Seção 1 do DOU).
// A página "leiturajornal" carrega um JSON embutido com todas as
// publicações do dia; filtramos pela hierarquia do órgão.
import { buscarTexto, limparHtml, resumir } from './util.js'

const FILTRO_ORGAO = /Conselho de Controle de Atividades Financeiras|COAF/i

export async function coletarDOU() {
  const itens = []

  // Olha os últimos 3 dias (cobre fim de semana e feriados; repetições são
  // descartadas pelo banco, que não aceita URL duplicada).
  for (let diasAtras = 0; diasAtras < 3; diasAtras++) {
    const dia = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)
    const data = [
      String(dia.getDate()).padStart(2, '0'),
      String(dia.getMonth() + 1).padStart(2, '0'),
      dia.getFullYear(),
    ].join('-')

    try {
      const html = await buscarTexto(`https://www.in.gov.br/leiturajornal?data=${data}&secao=do1`)
      for (const materia of extrairJsonArray(html)) {
        const hierarquia = [materia.hierarchyStr, ...(materia.hierarchyList ?? [])]
          .filter(Boolean)
          .join(' | ')
        if (!FILTRO_ORGAO.test(hierarquia)) continue
        if (!materia.urlTitle) continue
        itens.push({
          fonte: 'Coaf',
          categoria: 'Normativo',
          titulo: limparHtml(materia.title ?? materia.artType ?? 'Publicação no DOU'),
          resumo: resumir(materia.content ?? ''),
          url: `https://www.in.gov.br/web/dou/-/${materia.urlTitle}`,
          data_publicacao: dia.toISOString().slice(0, 10),
        })
      }
    } catch (erro) {
      const dica = erro.message.includes('fetch failed')
        ? ' (provável DNS: o in.gov.br não resolve em algumas redes; no GitHub Actions funciona)'
        : ''
      console.warn(`  aviso: DOU de ${data} falhou (${erro.message})${dica} — seguindo`)
    }
  }
  return itens
}

// Encontra "jsonArray":[...] dentro do HTML e recorta o array completo,
// contando colchetes (e ignorando os que estão dentro de strings).
function extrairJsonArray(html) {
  const posicao = html.indexOf('"jsonArray":')
  if (posicao === -1) return []
  const inicio = html.indexOf('[', posicao)
  let nivel = 0
  let dentroDeString = false
  let escapado = false
  for (let i = inicio; i < html.length; i++) {
    const c = html[i]
    if (escapado) { escapado = false; continue }
    if (c === '\\') { escapado = true; continue }
    if (c === '"') { dentroDeString = !dentroDeString; continue }
    if (dentroDeString) continue
    if (c === '[') nivel++
    else if (c === ']') {
      nivel--
      if (nivel === 0) return JSON.parse(html.slice(inicio, i + 1))
    }
  }
  return []
}
