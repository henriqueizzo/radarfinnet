// Diagnóstico: quantos itens vieram de cada fonte/categoria no banco.
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './config.local.js'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await supabase.from('noticias').select('fonte, categoria, temas')
if (error) {
  console.error(error.message)
  process.exit(1)
}

const porFonte = {}
for (const n of data) {
  const chave = `${n.fonte} · ${n.categoria}`
  porFonte[chave] = (porFonte[chave] ?? 0) + 1
}
console.log(`TOTAL DE ITENS: ${data.length}`)
for (const [chave, qtd] of Object.entries(porFonte).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${qtd.toString().padStart(3)}  ${chave}`)
}
const comTema = data.filter((n) => (n.temas ?? []).length > 0).length
console.log(`\nCom tema Finnet detectado: ${comTema} de ${data.length}`)
