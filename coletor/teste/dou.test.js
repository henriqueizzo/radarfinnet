// Testes do parser da página "leiturajornal" do DOU e do cálculo de datas.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { extrairJsonArray, diaEmBrasilia } from '../fontes/dou.js'

const htmlDoDou = readFileSync(new URL('./fixtures/dou-leiturajornal.html', import.meta.url), 'utf8')

describe('extrairJsonArray', () => {
  it('recorta o array de matérias embutido no HTML do DOU', () => {
    const materias = extrairJsonArray(htmlDoDou)
    expect(materias).toHaveLength(2)
    expect(materias[0].title).toBe('RESOLUÇÃO COAF Nº 60, DE 12 DE AGOSTO DE 2025')
    expect(materias[0].urlTitle).toBe('resolucao-coaf-n-60-de-12-de-agosto-de-2025-123456789')
    expect(materias[1].hierarchyStr).toBe('Ministério da Educação')
  })

  it('ignora colchetes e aspas escapadas dentro das strings', () => {
    const materias = extrairJsonArray(htmlDoDou)
    // o conteúdo tem "[PLD/FT]" e aspas escapadas — o contador de colchetes não pode se perder
    expect(materias[0].content).toBe(
      'Altera a Resolução Coaf nº 36 [PLD/FT] e dispõe sobre a comunicação de "operações suspeitas" ao Siscoaf.',
    )
  })

  it('devolve lista vazia quando o HTML não tem o jsonArray', () => {
    expect(extrairJsonArray('<html><body>Página fora do ar</body></html>')).toEqual([])
  })
})

describe('diaEmBrasilia', () => {
  afterEach(() => vi.useRealTimers())

  it('devolve o dia no formato AAAA-MM-DD', () => {
    expect(diaEmBrasilia(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('converte a madrugada em UTC para o dia anterior em Brasília', () => {
    vi.useFakeTimers()
    // 02h30 UTC do dia 16 = 23h30 do dia 15 em Brasília (UTC-3)
    vi.setSystemTime(new Date('2026-08-16T02:30:00Z'))
    expect(diaEmBrasilia(0)).toBe('2026-08-15')
    expect(diaEmBrasilia(1)).toBe('2026-08-14')
  })
})
