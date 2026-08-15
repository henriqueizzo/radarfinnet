// Log de atividades — registra o uso do sistema (como no LicitaFinnet).
// Os registros aparecem na aba "Atividade" (visível só para administradores).
import { supabase } from './supabaseClient.js'

// Rótulos pt-BR dos tipos de evento gravados
export const TIPOS_ATIVIDADE = {
  login: 'Login',
  enviar_radar: 'Envio ao Radar',
  mover_status: 'Mudança de status',
  editar_card: 'Edição de card',
  remover_card: 'Remoção do Radar',
}

export const rotuloTipo = (tipo) => TIPOS_ATIVIDADE[tipo] || tipo

// Grava sem travar a tela: se o log falhar, o sistema segue normal.
export function registrarAtividade({ demo = false, usuario, tipo, detalhe = '', noticiaId = null }) {
  if (demo || !supabase) return
  supabase
    .from('atividades')
    .insert({ usuario_email: usuario, tipo, detalhe, noticia_id: noticiaId })
    .then(({ error }) => {
      if (error) console.warn(`log de atividade falhou: ${error.message}`)
    })
}
