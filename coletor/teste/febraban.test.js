// Testes do coletor da Febraban usando o endpoint gravado em fixture
// (o fetch é simulado — nenhum teste acessa a internet).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { coletarFebraban } from '../fontes/febraban.js'

const respostaGravada = readFileSync(
  new URL('./fixtures/febraban-getitems.json', import.meta.url),
  'utf8',
)

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => JSON.parse(respostaGravada),
      text: async () => respostaGravada,
    })),
  )
})

afterEach(() => vi.unstubAllGlobals())

describe('coletarFebraban', () => {
  it('converte a data ASP.NET "/Date(...)/" para ISO e limpa o título', async () => {
    const itens = await coletarFebraban()
    expect(itens[0].titulo).toBe('Febraban lança guia sobre Pix Automático')
    expect(itens[0].url).toBe('https://portal.febraban.org.br/noticia/3899/pt-br/')
    expect(itens[0].data_publicacao).toBe('2024-08-15T00:00:00.000Z')
  })

  it('descarta notícias sem título e aceita data ausente como nula', async () => {
    const itens = await coletarFebraban()
    expect(itens).toHaveLength(2) // a notícia sem título ficou de fora
    expect(itens[1].titulo).toBe('Sistema financeiro debate Open Finance')
    expect(itens[1].data_publicacao).toBeNull()
  })
})
