// Utilitário: cria um usuário de login no Supabase Auth (via service_role).
// Uso: node coletor/criar-usuario.mjs email senha "Nome Completo"
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './config.local.js'

const [email, senha, nome = ''] = process.argv.slice(2)
if (!email || !senha) {
  console.error('Uso: node coletor/criar-usuario.mjs email senha "Nome Completo"')
  process.exit(1)
}

const resposta = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email,
    password: senha,
    email_confirm: true, // sem e-mail de confirmação: uso interno
    user_metadata: { nome },
  }),
})
const dados = await resposta.json()
if (!resposta.ok) {
  console.error(`ERRO HTTP ${resposta.status}: ${JSON.stringify(dados)}`)
  process.exit(1)
}
console.log(`USUÁRIO CRIADO: ${dados.email} (id ${dados.id})`)
