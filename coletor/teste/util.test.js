// Testes das ferramentas compartilhadas do coletor (funções puras).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { limparHtml, linkDoAtom, textoDoAtom } from '../fontes/util.js'

const lerFixture = (nome) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf8')

describe('limparHtml', () => {
  it('remove as tags HTML e devolve só o texto', () => {
    expect(limparHtml('<p>Banco Central <strong>publica</strong> nova norma</p>')).toBe(
      'Banco Central publica nova norma',
    )
  })

  it('decodifica entidades nomeadas, numéricas e hexadecimais', () => {
    expect(limparHtml('Aten&#231;&#227;o: &quot;Pix&quot; &amp; Open Finance &#x2014; teste')).toBe(
      'Atenção: "Pix" & Open Finance — teste',
    )
  })

  it('resolve o HTML duplamente codificado do feed do BCB', () => {
    expect(limparHtml(lerFixture('bcb-resumo.html'))).toBe(
      'Dispõe sobre a instituição do arranjo Pix e altera o Regulamento anexo à Resolução BCB nº 1.',
    )
  })
})

describe('linkDoAtom', () => {
  it('prefere o link rel="alternate" quando há vários e decodifica &amp; na URL', () => {
    const entrada = {
      link: [
        { '@rel': 'self', '@href': 'https://www.bcb.gov.br/api/feed/self' },
        { '@rel': 'alternate', '@href': 'https://www.bcb.gov.br/detalhamento?id=443&amp;tipo=norma' },
      ],
    }
    expect(linkDoAtom(entrada)).toBe('https://www.bcb.gov.br/detalhamento?id=443&tipo=norma')
  })

  it('aceita o link como texto simples', () => {
    expect(linkDoAtom({ link: 'https://www.gov.br/coaf/noticia/1' })).toBe(
      'https://www.gov.br/coaf/noticia/1',
    )
  })

  it('recorre ao id quando a entrada não tem link', () => {
    expect(linkDoAtom({ id: 'https://www.in.gov.br/web/dou/-/materia-2' })).toBe(
      'https://www.in.gov.br/web/dou/-/materia-2',
    )
  })
})

describe('textoDoAtom', () => {
  it('extrai o "#text" de campos com atributos e limpa o HTML', () => {
    const campo = { '#text': '<b>T&#237;tulo</b> importante', '@type': 'html' }
    expect(textoDoAtom(campo)).toBe('Título importante')
  })

  it('devolve texto vazio quando o campo não existe', () => {
    expect(textoDoAtom(undefined)).toBe('')
    expect(textoDoAtom(null)).toBe('')
  })
})
