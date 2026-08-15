// Utilitário: executa um arquivo .sql no projeto Supabase via Management API.
// Uso: node coletor/rodar-sql.mjs <ref-do-projeto> <arquivo.sql>
// O token vem da variável de ambiente SUPABASE_ACCESS_TOKEN.
import { readFileSync } from 'node:fs'

const [ref, arquivo] = process.argv.slice(2)
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !arquivo || !token) {
  console.error('Uso: SUPABASE_ACCESS_TOKEN=... node rodar-sql.mjs <ref> <arquivo.sql>')
  process.exit(1)
}

const query = readFileSync(arquivo, 'utf8')
const resposta = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})
const texto = await resposta.text()
if (!resposta.ok) {
  console.error(`ERRO HTTP ${resposta.status}: ${texto}`)
  process.exit(1)
}
console.log('SQL EXECUTADO COM SUCESSO')
if (texto && texto !== '[]') console.log(texto.slice(0, 500))
