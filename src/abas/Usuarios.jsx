// Gestor de usuários (só administradores) — portado do LicitaFinnet.
// As ações que exigem a chave secreta (criar, resetar senha, desativar)
// rodam na Edge Function "admin-usuarios" dentro do Supabase.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { PERFIS_DEMO } from '../lib/demo.js'

const NOVO = { nome: '', email: '', senha: '', is_admin: false }

const AJUDA_FUNCAO =
  'Não consegui falar com a função "admin-usuarios" do Supabase. ' +
  'Publique-a seguindo o passo a passo do docs/COMO-CONFIGURAR.md ' +
  '(Painel do Supabase → Edge Functions → Deploy).'

export default function Usuarios({ usuarioEmail, demo }) {
  const [usuarios, setUsuarios] = useState(demo ? PERFIS_DEMO : null)
  const [novo, setNovo] = useState(NOVO)
  const [msg, setMsg] = useState(null) // { texto, ok }
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    if (demo) return
    const { data, error } = await supabase.from('perfis').select('*').order('criado_em')
    if (error) setMsg({ texto: `Falha ao listar usuários: ${error.message}`, ok: false })
    else setUsuarios(data)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Chama a Edge Function e devolve { ok } ou { erro }
  async function chamarAdmin(corpo) {
    const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: corpo })
    if (error) return { erro: AJUDA_FUNCAO }
    return data ?? { erro: 'Resposta vazia da função.' }
  }

  async function criar(e) {
    e.preventDefault()
    if (!novo.nome.trim() || !novo.email.trim() || novo.senha.length < 6) {
      setMsg({ texto: 'Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.', ok: false })
      return
    }
    if (demo) {
      setUsuarios((atuais) => [
        ...atuais,
        { id: `demo-u${atuais.length + 1}`, nome: novo.nome.trim(), email: novo.email.trim(), is_admin: novo.is_admin, ativo: true, criado_em: new Date().toISOString() },
      ])
      setNovo(NOVO)
      setMsg({ texto: 'Usuário criado (modo demonstração — some ao recarregar).', ok: true })
      return
    }
    setSalvando(true)
    setMsg(null)
    const r = await chamarAdmin({ acao: 'criar', nome: novo.nome.trim(), email: novo.email.trim(), senha: novo.senha, is_admin: novo.is_admin })
    setSalvando(false)
    if (r.erro) {
      setMsg({ texto: r.erro, ok: false })
      return
    }
    setNovo(NOVO)
    setMsg({ texto: 'Usuário criado. Informe a senha a ele com segurança.', ok: true })
    await carregar()
  }

  async function alternarAtivo(u) {
    const acao = u.ativo ? 'Desativar' : 'Reativar'
    if (!window.confirm(`${acao} o acesso de ${u.nome || u.email}?`)) return
    if (demo) {
      setUsuarios((atuais) => atuais.map((x) => (x.id === u.id ? { ...x, ativo: !x.ativo } : x)))
      return
    }
    const r = await chamarAdmin({ acao: 'definir_ativo', id: u.id, ativo: !u.ativo })
    if (r.erro) setMsg({ texto: r.erro, ok: false })
    else await carregar()
  }

  async function alternarAdmin(u) {
    if (demo) {
      setUsuarios((atuais) => atuais.map((x) => (x.id === u.id ? { ...x, is_admin: !x.is_admin } : x)))
      return
    }
    const r = await chamarAdmin({ acao: 'definir_admin', id: u.id, is_admin: !u.is_admin })
    if (r.erro) setMsg({ texto: r.erro, ok: false })
    else await carregar()
  }

  async function resetarSenha(u) {
    const senha = window.prompt(`Nova senha para ${u.nome || u.email} (mínimo 6 caracteres):`)
    if (senha === null) return
    if (senha.length < 6) {
      setMsg({ texto: 'A senha deve ter pelo menos 6 caracteres.', ok: false })
      return
    }
    if (demo) {
      setMsg({ texto: `Senha de ${u.nome || u.email} redefinida (modo demonstração).`, ok: true })
      return
    }
    const r = await chamarAdmin({ acao: 'resetar_senha', id: u.id, senha })
    if (r.erro) setMsg({ texto: r.erro, ok: false })
    else setMsg({ texto: `Senha de ${u.nome || u.email} redefinida.`, ok: true })
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
