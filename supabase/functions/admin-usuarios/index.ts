// ============================================================
// Edge Function: admin-usuarios
//
// Faz as ações administrativas do gestor de usuários (criar,
// resetar senha, ativar/desativar, tornar admin). Roda DENTRO do
// Supabase com a chave service_role — que nunca vai ao navegador.
// Só aceita chamadas de usuários com is_admin = true na tabela perfis.
//
// Como publicar (sem instalar nada):
//   Painel do Supabase → Edge Functions → Deploy a new function
//   → nome: admin-usuarios → cole este arquivo inteiro → Deploy.
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}

// Sempre responde HTTP 200 com { ok } ou { erro } — o site só olha o corpo.
const responder = (corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Cliente com a service_role (variáveis já fornecidas pelo Supabase)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1) Quem está chamando precisa estar logado…
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: autenticado } = await admin.auth.getUser(token)
    const chamador = autenticado?.user
    if (!chamador) return responder({ erro: 'Você precisa estar logado.' })

    // 2) …e ser administrador ativo.
    const { data: perfil } = await admin
      .from('perfis')
      .select('is_admin, ativo')
      .eq('id', chamador.id)
      .single()
    if (!perfil?.is_admin || !perfil?.ativo) {
      return responder({ erro: 'Apenas administradores podem gerenciar usuários.' })
    }

    const { acao, ...dados } = await req.json()

    if (acao === 'criar') {
      if (!dados.email || !dados.senha || dados.senha.length < 6) {
        return responder({ erro: 'Informe e-mail e uma senha com pelo menos 6 caracteres.' })
      }
      const { data, error } = await admin.auth.admin.createUser({
        email: dados.email,
        password: dados.senha,
        email_confirm: true, // sem e-mail de confirmação: uso interno
        user_metadata: { nome: dados.nome ?? '' },
      })
      if (error) return responder({ erro: error.message })
      // o trigger já criou o perfil; ajusta nome e papel
      await admin
        .from('perfis')
        .update({ nome: dados.nome ?? '', is_admin: !!dados.is_admin })
        .eq('id', data.user.id)
      return responder({ ok: true })
    }

    if (acao === 'resetar_senha') {
      if (!dados.senha || dados.senha.length < 6) {
        return responder({ erro: 'A senha deve ter pelo menos 6 caracteres.' })
      }
      const { error } = await admin.auth.admin.updateUserById(dados.id, {
        password: dados.senha,
      })
      return responder(error ? { erro: error.message } : { ok: true })
    }

    if (acao === 'definir_ativo') {
      if (dados.id === chamador.id) {
        return responder({ erro: 'Você não pode desativar a si mesmo.' })
      }
      // bloqueia (ou libera) o login no próprio Supabase…
      const { error } = await admin.auth.admin.updateUserById(dados.id, {
        ban_duration: dados.ativo ? 'none' : '876000h', // ~100 anos
      })
      if (error) return responder({ erro: error.message })
      // …e marca o perfil (as regras do banco cortam o acesso na hora)
      await admin.from('perfis').update({ ativo: !!dados.ativo }).eq('id', dados.id)
      return responder({ ok: true })
    }

    if (acao === 'definir_admin') {
      if (dados.id === chamador.id) {
        return responder({ erro: 'Você não pode alterar seu próprio perfil.' })
      }
      const { error } = await admin
        .from('perfis')
        .update({ is_admin: !!dados.is_admin })
        .eq('id', dados.id)
      return responder(error ? { erro: error.message } : { ok: true })
    }

    return responder({ erro: `Ação desconhecida: ${acao}` })
  } catch (e) {
    return responder({ erro: `Falha inesperada: ${String(e)}` })
  }
})
