import { useState } from 'react'
import { supabase } from './lib/supabaseClient.js'
import { registrarAtividade } from './lib/atividade.js'

export default function TelaLogin() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(evento) {
    evento.preventDefault()
    setEnviando(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : `Não consegui entrar: ${error.message}`,
      )
    } else {
      registrarAtividade({ usuario: email, tipo: 'login' })
    }
    setEnviando(false)
  }

  return (
    <div className="login-fundo">
      <form className="login-card" onSubmit={entrar}>
        <span className="logo-chip login-logo-chip">
          <img src="./finnet-logo.png" alt="Finnet" className="login-logo" />
        </span>
        <span className="login-sub">Radar Regulatório · Acesso da equipe</span>
        {erro && <div className="login-erro">{erro}</div>}
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@finnet.com.br"
            required
            autoFocus
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </label>
        <button className="primario" disabled={enviando}>
          {enviando ? '⏳ Entrando…' : 'Entrar'}
        </button>
        <span className="pendente" style={{ textAlign: 'center' }}>
          Sem acesso? Peça ao administrador para criar seu usuário.
        </span>
      </form>
    </div>
  )
}
