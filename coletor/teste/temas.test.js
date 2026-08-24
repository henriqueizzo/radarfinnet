// Testes do detector de temas regulatórios da Finnet.
import { describe, it, expect } from 'vitest'
import { detectarTemas } from '../temas.js'

describe('detectarTemas', () => {
  it('encontra o tema mesmo com acentos e maiúsculas no texto', () => {
    expect(detectarTemas('Bacen atualiza regras das Instituições de Pagamento')).toEqual([
      'Instituições de Pagamento',
    ])
  })

  it('devolve todos os temas que aparecem no texto', () => {
    const temas = detectarTemas(
      'Resolução sobre Pix e Open Finance amplia a iniciação de pagamento e o combate à lavagem de dinheiro',
    )
    expect(temas).toEqual(['Pix', 'Open Finance', 'PLD/FT'])
  })

  it('só aceita palavra inteira e devolve lista vazia quando nada bate', () => {
    expect(detectarTemas('novo pixel da câmera do celular')).toEqual([]) // "pixel" não é Pix
    expect(detectarTemas('assunto totalmente fora do radar')).toEqual([])
  })
})
