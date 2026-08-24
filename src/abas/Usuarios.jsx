// Gestor de usuários (só administradores) — portado do LicitaFinnet.
// As chamadas ao banco/Edge Function ficam em lib/api.js (com modo demonstração).
import { useEffect, useState } from 'react'
import {
  listarUsuarios,
  criarUsuario,
  definirUsuarioAtivo,
  definirUsuarioAdmin,
  resetarSenhaUsuario,
} from '../lib/api.js'
import { PERFIS_DEMO } from '../lib/demo.js'
import { useAvisos } from '../componentes/Avisos.jsx'

const NOVO = { nome: '', email: '', senha: '', is_admin: false }

export default function Usuarios({ usuarioEmail, demo }) {
  const { confirmar } = useAvisos()
  const [usuarios, setUsuarios] = useState(demo ? PERFIS_DEMO : null)
  const [novo, setNovo] = useState(NOVO)
  const [msg, setMsg] = useState(null) // { texto, ok }
  const [salvando, setSalvando] = useState(false)

  // No modo demonstração a lista já abre preenchida e não é recarregada
  // (senão as mudanças de mentira sumiriam da tela).
  async function carregar() {
    if (demo) return
    const r = await listarUsuarios({ demo })
    if (!r.ok) setMsg({ texto: `Falha ao listar usuários: ${r.erro}`, ok: false })
    else setUsuarios(r.dados)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function criar(e) {
    e.preventDefault()
    if (!novo.nome.trim() || !novo.email.trim() || novo.senha.length < 6) {
      setMsg({ texto: 'Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.', ok: false })
      return
    }
    setSalvando(true)
    setMsg(null)
    const r = await criarUsuario({
      demo,
      nome: novo.nome.trim(),
      email: novo.email.trim(),
      senha: novo.senha,
      is_admin: novo.is_admin,
    })
    setSalvando(false)
    if (!r.ok) {
      setMsg({ texto: r.erro, ok: false })
      return
    }
    setNovo(NOVO)
    if (r.usuarioDemo) {
      setUsuarios((atuais) => [...atuais, r.usuarioDemo])
      setMsg({ texto: 'Usuário criado (modo demonstração — some ao recarregar).', ok: true })
      return
    }
    setMsg({ texto: 'Usuário criado. Informe a senha a ele com segurança.', ok: true })
    await carregar()
  }

  async function alternarAtivo(u) {
    const acao = u.ativo ? 'Desativar' : 'Reativar'
    const confirmou = await confirmar({
      titulo: `${acao} acesso`,
      mensagem: `${acao} o acesso de ${u.nome || u.email}?`,
      confirmarTexto: acao,
      perigoso: u.ativo, // desativar é a ação "vermelha"
    })
    if (!confirmou) return
    // muda na tela na hora; carregar() sincroniza (e desfaz se der erro)
    setUsuarios((atuais) => atuais.map((x) => (x.id === u.id ? { ...x, ativo: !x.ativo } : x)))
    const r = await definirUsuarioAtivo({ demo, id: u.id, ativo: !u.ativo })
    if (!r.ok) setMsg({ texto: r.erro, ok: false })
    await carregar()
  }

  async function alternarAdmin(u) {
    setUsuarios((atuais) => atuais.map((x) => (x.id === u.id ? { ...x, is_admin: !x.is_admin } : x)))
    const r = await definirUsuarioAdmin({ demo, id: u.id, is_admin: !u.is_admin })
    if (!r.ok) setMsg({ texto: r.erro, ok: false })
    await carregar()
  }

  async function resetarSenha(u) {
    const senha = await confirmar({
      titulo: 'Resetar senha',
      mensagem: `Defina a nova senha de acesso de ${u.nome || u.email}. Informe a ele com segurança.`,
      confirmarTexto: 'Redefinir senha',
      campo: { rotulo: 'Nova senha (mínimo 6 caracteres)', tipo: 'password', placeholder: '••••••' },
    })
    if (senha === null) return
    if (senha.length < 6) {
      setMsg({ texto: 'A senha deve ter pelo menos 6 caracteres.', ok: false })
      return
    }
    const r = await resetarSenhaUsuario({ demo, id: u.id, senha })
    if (!r.ok) setMsg({ texto: r.erro, ok: false })
    else
      setMsg({
        texto: `Senha de ${u.nome || u.email} redefinida${demo ? ' (modo demonstração)' : ''}.`,
        ok: true,
      })
  }

  return (
    <div className="usuarios">
      {msg && <div className={msg.ok ? 'form-msg' : 'banner erro'}>{msg.texto}</div>}

      <table className="tabela">
        <thead>
          <tr>
            <th>Nome</th>
            <th>E-mail</th>
            <th>Perfil</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {(usuarios ?? []).map((u) => {
            const souEu = u.email === usuarioEmail
            return (
              <tr key={u.id}>
                <td>
                  {u.nome || '—'}
                  {souEu && <small className="pendente"> (você)</small>}
                </td>
                <td>{u.email}</td>
                <td>
                  <span className={`veredito ${u.is_admin ? 'verde' : 'amarelo'}`}>
                    {u.is_admin ? 'Administrador' : 'Usuário'}
                  </span>
                </td>
                <td>
                  <span className={`veredito ${u.ativo ? 'verde' : 'vermelho'}`}>
                    {u.ativo ? 'Ativo' : 'Desativado'}
                  </span>
                </td>
                <td>
                  <div className="acoes">
                    <button onClick={() => resetarSenha(u)}>Resetar senha</button>
                    <button
                      onClick={() => alternarAdmin(u)}
                      disabled={souEu}
                      title={souEu ? 'Você não pode alterar seu próprio perfil' : ''}
                    >
                      {u.is_admin ? 'Tornar usuário' : 'Tornar admin'}
                    </button>
                    <button
                      onClick={() => alternarAtivo(u)}
                      disabled={souEu}
                      title={souEu ? 'Você não pode desativar a si mesmo' : ''}
                    >
                      {u.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
          {usuarios === null && (
            <tr>
              <td colSpan={5} className="pendente">Carregando…</td>
            </tr>
          )}
          {usuarios?.length === 0 && (
            <tr>
              <td colSpan={5} className="pendente">Nenhum usuário encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>

      <form className="formulario usuarios-novo" onSubmit={criar}>
        <strong>Novo usuário</strong>
        <div className="grade">
          <label>
            Nome
            <input
              value={novo.nome}
              onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              placeholder="Nome completo"
            />
          </label>
          <label>
            E-mail (usado no login)
            <input
              type="email"
              value={novo.email}
              onChange={(e) => setNovo({ ...novo, email: e.target.value })}
              placeholder="pessoa@finnet.com.br"
              autoComplete="off"
            />
          </label>
          <label>
            Senha inicial (mínimo 6 caracteres)
            <input
              type="password"
              value={novo.senha}
              onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
              autoComplete="new-password"
            />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={novo.is_admin}
            onChange={(e) => setNovo({ ...novo, is_admin: e.target.checked })}
          />
          Administrador (pode gerenciar usuários e ver a atividade)
        </label>
        <div>
          <button type="submit" className="primario" disabled={salvando}>
            {salvando ? '⏳ Criando…' : 'Criar usuário'}
          </button>
        </div>
      </form>
    </div>
  )
}
