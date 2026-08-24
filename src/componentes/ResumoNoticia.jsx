// Resumo de uma notícia dentro de um card (Feed, Radar e janela de detalhes).
// Texto corrido na maioria dos casos; quando o resumo vem em tópicos
// (os Informes do Open Finance), vira uma lista "Descrição:".
// completo=true (janela de detalhes): fonte maior e sem corte de linhas.
import { topicosDoResumo } from '../lib/util.js'

export default function ResumoNoticia({ resumo, completo = false }) {
  if (!resumo) return null
  const topicos = topicosDoResumo(resumo)

  if (!topicos) {
    if (completo) return <p className="resumo-completo">{resumo}</p>
    return (
      <p className="cartao-resumo" title={resumo}>
        {resumo}
      </p>
    )
  }

  return (
    <div className={`cartao-descricao ${completo ? 'descricao-completa' : ''}`}>
      <span className="cartao-descricao-rotulo">Descrição:</span>
      <ul>
        {topicos.map((topico, i) => (
          <li key={i}>{topico}</li>
        ))}
      </ul>
    </div>
  )
}
