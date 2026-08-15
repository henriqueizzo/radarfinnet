// ⚙️ CONFIGURAÇÃO DO SUPABASE (para o SITE)
//
// Depois de criar seu projeto em https://supabase.com:
// 1. Vá em Project Settings → API
// 2. Copie a "Project URL" e a chave "anon public"
// 3. Cole nos dois campos abaixo (entre as aspas)
//
// Obs.: a chave "anon" é pública por natureza — a segurança real
// fica nas regras (RLS) do banco, que estão em supabase/schema.sql.
// A chave service_role (do coletor) NUNCA entra aqui.

export const SUPABASE_URL = 'https://giipvdzsxfxomnhnmyvd.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpaXB2ZHpzeGZ4b21uaG5teXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3ODgxOTIsImV4cCI6MjEwMjM2NDE5Mn0.AY2IdmrSCLE1t-4XpmdHnZcVfEDKZiBIXRNVRCYpodU'
