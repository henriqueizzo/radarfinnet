// Utilitário: publica a Edge Function admin-usuarios no Supabase.
// Uso: SUPABASE_ACCESS_TOKEN=... node coletor/publicar-funcao.mjs <ref-do-projeto>
import { readFileSync } from 'node:fs'

const [ref] = process.argv.slice(2)
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !token) {
  console.error('Uso: SUPABASE_ACCESS_TOKEN=... node publicar-funcao.mjs <ref>')
  process.exit(1)
}

const codigo = readFileSync('supabase/functions/admin-usuarios/index.ts', 'utf8')

const form = new FormData()
form.append(
  'metadata',
  JSON.stringify({
    name: 'admin-usuarios',
    entrypoint_path: 'index.ts',
    verify_jwt: true,
  }),
)
form.append('file', new Blob([codigo], { type: 'application/typescript' }), 'index.ts')

const resposta = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=admin-usuarios`,
  { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
)
const texto = await resposta.text()
if (!resposta.ok) {
  console.error(`ERRO HTTP ${resposta.status}: ${texto}`)
  process.exit(1)
}
console.log('EDGE FUNCTION PUBLICADA COM SUCESSO')
console.log(texto.slice(0, 300))
