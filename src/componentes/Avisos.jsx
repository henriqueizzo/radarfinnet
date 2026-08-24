// Avisos do sistema — substituem os alert()/confirm()/prompt() do navegador.
//
// Uso (dentro de qualquer componente sob o <ProvedorAvisos>):
//   const { toast, confirmar } = useAvisos()
//   toast('Alterações salvas.', 'ok')          // 'ok' | 'erro' | 'info'
//   const sim = await confirmar({ titulo, mensagem, confirmarTexto, perigoso })
//   const texto = await confirmar({ ..., campo: { rotulo, tipo, placeholder } })
//     → com "campo", devolve o texto digitado (ou null se cancelou)
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const CtxAvisos = createContext(null)

export function useAvisos() {
  return useContext(CtxAvisos)
}

export function ProvedorAvisos({ children }) {
  const [toasts, setToasts] = useState([])
  const [pedido, setPedido] = useState(null) // confirmação aberta (ou null)
  const proximoId = useRef(1)

  // Toast no canto da tela — some sozinho depois de alguns segundos
  const toast = useCallback((texto, tipo = 'info') => {
    const id = proximoId.current++
    setToasts((atuais) => [...atuais, { id, texto, tipo }])
    setTimeout(() => setToasts((atuais) => atuais.filter((t) => t.id !== id)), 6000)
  }, [])

  // Abre o modal e espera a resposta (Promise)
  const confirmar = useCallback(
    (opcoes) => new Promise((resolve) => setPedido({ ...opcoes, resolve })),
    [],
  )

  function responder(valor) {
    pedido.resolve(valor)
    setPedido(null)
  }

  return (
    <CtxAvisos.Provider value={{ toast, confirmar }}>
      {children}

      <div className="toast-area" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.tipo}`}
            title="Clique para dispensar"
            onClick={() => setToasts((atuais) => atuais.filter((x) => x.id !== t.id))}
          >
            {t.tipo === 'erro' ? '⚠️ ' : t.tipo === 'ok' ? '✅ ' : ''}
            {t.texto}
          </div>
        ))}
      </div>

      {pedido && <ModalConfirmar pedido={pedido} responder={responder} />}
    </CtxAvisos.Provider>
  )
}

function ModalConfirmar({ pedido, responder }) {
  const [valor, setValor] = useState('')
  const comCampo = Boolean(pedido.campo)

  const cancelar = () => responder(comCampo ? null : false)
  const confirmar = () => responder(comCampo ? valor : true)

  // Esc fecha o modal (como cancelar)
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === 'Escape') responder(comCampo ? null : false)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="modal-fundo" onClick={cancelar}>
      <div
        className="janela confirmar-caixa"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="janela-cabecalho">
          <strong>{pedido.titulo ?? 'Confirmação'}</strong>
          <div className="janela-botoes">
            <button aria-label="Fechar" onClick={cancelar}>✕</button>
          </div>
        </div>
        <div className="janela-corpo">
          {pedido.mensagem && <p className="confirmar-texto">{pedido.mensagem}</p>}

          {comCampo && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                confirmar()
              }}
            >
              <p className="secao-rotulo">{pedido.campo.rotulo}</p>
              <input
                type={pedido.campo.tipo ?? 'text'}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={pedido.campo.placeholder ?? ''}
                autoFocus
              />
            </form>
          )}

          <div className="janela-rodape">
            <button className="usuario-btn" onClick={cancelar}>
              Cancelar
            </button>
            {/* Ação destrutiva usa o vermelho pastel do guia (nunca sólido) */}
            {pedido.perigoso ? (
              <button className="usuario-btn btn-excluir" onClick={confirmar} autoFocus={!comCampo}>
                {pedido.confirmarTexto ?? 'Confirmar'}
              </button>
            ) : (
              <button className="primario" onClick={confirmar} autoFocus={!comCampo}>
                {pedido.confirmarTexto ?? 'Confirmar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
