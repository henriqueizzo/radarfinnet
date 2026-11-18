// Conexão do robô com o Supabase (chave service_role).
// No GitHub Actions os valores vêm dos Secrets; no seu PC, do arquivo
// coletor/config.local.js (que o git ignora).
import { createClient } from '@supabase/supabase-js'

export async function conectarSupabase() {
  let url = process.env.SUPABASE_URL
  let chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) {
    try {
      const local = await import('./config.local.js')
      url = url || local.SUPABASE_URL
      chave = chave || local.SUPABASE_SERVICE_ROLE_KEY
    } catch {
      /* arquivo local não existe — tudo bem, o erro abaixo explica */
    }
  }
  if (!url || !chave) {
    throw new Error(
      'faltam as credenciais do Supabase. Crie o arquivo coletor/config.local.js ' +
        '(copie do config.local.exemplo.js) ou defina as variáveis SUPABASE_URL e ' +
        'SUPABASE_SERVICE_ROLE_KEY. Para testar sem banco: npm run coletar:teste',
    )
  }
  return createClient(url, chave)
}
