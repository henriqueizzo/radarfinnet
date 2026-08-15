// Diagnóstico: confirma se o login funciona de fora (como o site faz).
// Uso: node coletor/testar-login.mjs email senha
import { SUPABASE_URL } from './config.local.js'
import { SUPABASE_ANON_KEY } from '../src/lib/config.js'

const [email, senha] = process.argv.slice(2)

const resposta = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: senha }),
})
const dados = await resposta.json()
if (!resposta.ok) {
  console.log(`❌ LOGIN FALHOU (HTTP ${resposta.status}): ${dados.error_description ?? dados.msg ?? JSON.stringify(dados)}`)
  process.exit(1)
}
console.log(`✅ LOGIN OK — usuário ${dados.user.email}`)
