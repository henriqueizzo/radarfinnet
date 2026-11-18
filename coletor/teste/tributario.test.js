import { describe, expect, it } from 'vitest'
import {
  calcularPrioridade,
  detectarAssuntos,
  detectarSinais,
  statusInicial,
  tituloCitaBanco,
} from '../tributario/analise.js'
import { ehDoBanco, lerItem, separarVeiculo } from '../tributario/googlenews.js'
import { montarPublicacao } from '../coletar-tributario.js'
import { BANCOS, NOMES_BANCOS } from '../tributario/bancos.js'

const banco = (nome) => BANCOS.find((b) => b.nome === nome)

describe('análise de publicações', () => {
  it('detecta os dois assuntos sem depender de acento', () => {
    expect(detectarAssuntos('Split payment: entenda seu papel na Reforma Tributária')).toEqual([
      'Split Payment',
      'Reforma Tributária',
    ])
    expect(detectarAssuntos('CBS: TCU aprova alíquota de 11,3%')).toEqual(['Reforma Tributária'])
    expect(detectarAssuntos('Banco lança conta para torcedores')).toEqual([])
  })

  it('não confunde sigla com pedaço de palavra', () => {
    expect(detectarAssuntos('Peça de Ibsen estreia em SP')).toEqual([])
  })

  it('aponta sinais de ação', () => {
    expect(detectarSinais('Banco divulga novo layout CNAB para o split payment a partir de 2027')).toEqual(
      expect.arrayContaining(['Layout/Integração', 'Prazo/Cronograma']),
    )
    expect(detectarSinais('Reforma Tributária: o que muda para quem é MEI?')).toContain('Orientação a clientes')
  })

  it('prioriza split payment técnico ou publicado pelo banco', () => {
    expect(calcularPrioridade({ assuntos: ['Split Payment'], sinais: ['Layout/Integração'], origem: 'Imprensa' })).toBe('Alta')
    expect(calcularPrioridade({ assuntos: ['Split Payment'], sinais: [], origem: 'Site do banco' })).toBe('Alta')
    expect(calcularPrioridade({ assuntos: ['Reforma Tributária'], sinais: [], origem: 'Site do banco' })).toBe('Média')
    expect(calcularPrioridade({ assuntos: ['Split Payment'], sinais: [], origem: 'Imprensa' })).toBe('Média')
    expect(calcularPrioridade({ assuntos: ['Reforma Tributária'], sinais: [], origem: 'Imprensa' })).toBe('Baixa')
  })

  it('publicação antiga entra como Histórico', () => {
    const agora = new Date('2026-11-12T12:00:00Z').getTime()
    expect(statusInicial('2026-11-10T00:00:00Z', agora)).toBe('Novo')
    expect(statusInicial('2026-09-01T00:00:00Z', agora)).toBe('Histórico')
    expect(statusInicial(null, agora)).toBe('Novo')
  })

  it('confere o nome do banco no título', () => {
    expect(tituloCitaBanco('Itaú lança solução de split payment', banco('Itaú Unibanco'))).toBe(true)
    expect(tituloCitaBanco('Fluxo de caixa e reforma tributária', banco('Caixa Econômica Federal'))).toBe(false)
  })
})

describe('Google News', () => {
  it('separa o veículo do título', () => {
    expect(separarVeiculo('Split payment: como funcionará - Safra', 'Safra')).toBe('Split payment: como funcionará')
  })

  it('lê um item do RSS', () => {
    const item = lerItem({
      title: 'Split payment: entenda seu papel - Santander Brasil',
      link: 'https://news.google.com/rss/articles/abc?oc=5&amp;x=1',
      pubDate: 'Wed, 04 Nov 2026 10:00:00 GMT',
      source: { '#text': 'Santander Brasil', '@url': 'https://www.santander.com.br' },
    })
    expect(item).toMatchObject({
      titulo: 'Split payment: entenda seu papel',
      url: 'https://news.google.com/rss/articles/abc?oc=5&x=1',
      veiculo: 'Santander Brasil',
      data_publicacao: '2026-11-04T10:00:00.000Z',
    })
    expect(ehDoBanco(item.siteVeiculo, ['santander.com.br'])).toBe(true)
    expect(ehDoBanco('https://www.infomoney.com.br', ['santander.com.br'])).toBe(false)
  })
})

describe('montarPublicacao', () => {
  const item = (titulo, site) => ({
    titulo,
    url: 'https://news.google.com/x',
    veiculo: 'X',
    siteVeiculo: site,
    data_publicacao: '2026-11-10T00:00:00Z',
  })

  it('aceita o que o banco publicou no próprio site', () => {
    const p = montarPublicacao(banco('Banco Safra'), item('Split payment muda o caixa', 'https://www.safra.com.br'), { buscaPorSite: true })
    expect(p).toMatchObject({ banco: 'Banco Safra', origem: 'Site do banco', prioridade: 'Alta' })
  })

  it('descarta resultado de outro site na busca por site', () => {
    expect(montarPublicacao(banco('Banco Safra'), item('Split payment muda o caixa', 'https://www.infomoney.com.br'), { buscaPorSite: true })).toBeNull()
  })

  it('imprensa só entra se citar o banco no título', () => {
    const b = banco('Bradesco')
    expect(montarPublicacao(b, item('Bradesco prevê split payment em 2027', 'https://valor.globo.com'), { buscaPorSite: false })).toMatchObject({ origem: 'Imprensa' })
    expect(montarPublicacao(b, item('Empresas avaliam adiamento da reforma tributária', 'https://valor.globo.com'), { buscaPorSite: false })).toBeNull()
  })

  it('mercado geral só aceita split payment', () => {
    const mercado = BANCOS.find((b) => b.geral)
    expect(montarPublicacao(mercado, item('Split payment começa em 2027', 'https://g1.globo.com'), { buscaPorSite: false })).not.toBeNull()
    expect(montarPublicacao(mercado, item('Reforma tributária avança no Senado', 'https://g1.globo.com'), { buscaPorSite: false })).toBeNull()
  })

  it('documentação de layout entra só quando vem do site do banco', () => {
    const b = banco('Itaú Unibanco')
    expect(montarPublicacao(b, item('Layout de Arquivos', 'https://www.itau.com.br'), { buscaPorSite: true })).toMatchObject({
      assuntos: ['Layout/Documentação'],
      origem: 'Site do banco',
      prioridade: 'Média',
    })
    // página genérica que o Google devolveu na busca de layout: fora
    expect(montarPublicacao(b, item('Itaú Uniclass: confira as vantagens', 'https://www.itau.com.br'), { buscaPorSite: true })).toBeNull()
    // "leiaute" na imprensa é nota fiscal, não arquivo bancário
    expect(montarPublicacao(b, item('Itaú e o novo leiaute da NFS-e', 'https://valor.globo.com'), { buscaPorSite: false })).toBeNull()
  })

  it('layout que já fala de split ou reforma é Alta', () => {
    const p = montarPublicacao(banco('Febraban (setor bancário)'), item('Layout CNAB 240 com campos do split payment', 'https://portal.febraban.org.br'), { buscaPorSite: true })
    expect(p.assuntos).toEqual(expect.arrayContaining(['Layout/Documentação', 'Split Payment']))
    expect(p.prioridade).toBe('Alta')
    expect(detectarAssuntos('Padrão FEBRABAN 240 Posições V6.0')).toEqual(['Layout/Documentação'])
  })

  it('lista da Finnet não tem nomes repetidos e não inclui os extras', () => {
    expect(new Set(NOMES_BANCOS).size).toBe(NOMES_BANCOS.length)
    expect(NOMES_BANCOS).not.toContain('Febraban (setor bancário)')
    expect(NOMES_BANCOS).toHaveLength(57) // 59 linhas do print menos 2 repetidas
  })
})
