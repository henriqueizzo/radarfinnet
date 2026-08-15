// ⚙️ CREDENCIAIS DO COLETOR (para rodar no SEU computador)
//
// 1. Copie este arquivo com o nome  config.local.js  (nesta mesma pasta)
// 2. No painel do Supabase: Project Settings → API
//    - "Project URL"       → SUPABASE_URL
//    - chave "service_role" → SUPABASE_SERVICE_ROLE_KEY
//
// 🚨 A chave service_role é SECRETA: ela ignora as regras de segurança
// do banco. O arquivo config.local.js está no .gitignore justamente para
// nunca ir ao GitHub. No GitHub Actions, use os Secrets do repositório.

export const SUPABASE_URL = 'COLE_AQUI_A_URL_DO_PROJETO'
export const SUPABASE_SERVICE_ROLE_KEY = 'COLE_AQUI_A_CHAVE_SERVICE_ROLE'
