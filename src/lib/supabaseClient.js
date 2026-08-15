import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

// Verifica se o usuário já preencheu o config.js
export const configurado =
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 30

export const supabase = configurado
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null
