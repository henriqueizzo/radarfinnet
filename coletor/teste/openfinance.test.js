// Testes do leitor do "Repositório de Informes" do Open Finance
// (a extração é uma função pura — nenhum teste acessa a internet).
import { describe, it, expect } from 'vitest'
import { extrairInformes } from '../fontes/openfinance.js'

// Recorte real (simplificado) da tabela da página "Repositório de Informes":
// colunas Link (eepurl), Descrição (tópicos em <li>) e Data de envio (<time>)
const TABELA = `
<table class="confluenceTable"><tbody>
<tr><td><p><strong>Link</strong></p></td><td><p><strong>Descrição</strong></p></td><td><p><strong>Data de envio</strong></p></td></tr>
<tr>
  <td><p><a href="http://eepurl.com/BDBdVsHcoy" class="external-link">http://eepurl.com/BDBdVsHcoy</a></p></td>
  <td>
    <ul><li><p>Divulgação Aprovação do Cronograma Projeto CIBA </p></li></ul>
    <ul><li><p>Aviso de atualização programada do Diretório de Participantes</p></li></ul>
  </td>
  <td><p><time datetime="2026-08-21" class="date-past">21 de ago. de 2026</time></p></td>
</tr>
<tr>
  <td><p><a href="http://eepurl.com/DIXiwOA2FU">http://eepurl.com/DIXiwOA2FU</a></p></td>
  <td><ul>
    <li><p>Disponibilização do painel [BSC] Produtos</p></li>
    <li><p>Encerramento do período de convivência da API Pagamentos</p></li>
  </ul></td>
  <td><p><time datetime="2026-08-19">19 de ago. de 2026</time></p></td>
</tr>
<tr><td><p>linha estranha sem link nem data</p></td><td></td><td></td></tr>
</tbody></table>`

describe('extrairInformes', () => {
  it('lê link, tópicos e data de envio de cada linha da tabela', () => {
    const informes = extrairInformes(TABELA)
    expect(informes).toHaveLength(2) // cabeçalho e linha sem link ficam de fora
    expect(informes[0].url).toBe('http://eepurl.com/BDBdVsHcoy')
    expect(informes[0].dataEnvio).toBe('2026-08-21')
    expect(informes[0].topicos).toEqual([
      'Divulgação Aprovação do Cronograma Projeto CIBA',
      'Aviso de atualização programada do Diretório de Participantes',
    ])
  })

  it('mantém os tópicos na ordem e limpa as tags HTML', () => {
    const informes = extrairInformes(TABELA)
    expect(informes[1].topicos).toEqual([
      'Disponibilização do painel [BSC] Produtos',
      'Encerramento do período de convivência da API Pagamentos',
    ])
    expect(informes[1].dataEnvio).toBe('2026-08-19')
  })

  it('devolve lista vazia para HTML sem tabela', () => {
    expect(extrairInformes('<p>nada aqui</p>')).toEqual([])
  })
})
