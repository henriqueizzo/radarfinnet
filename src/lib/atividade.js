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
  arquivar_noticia: 'Notícia arquivada',
  restaurar_noticia: 'Notícia restaurada',
  editar_temas: 'Edição de temas',
  registrar_comunicacao: 'Comunicação registrada',
  editar_comunicacao: 'Comunicação editada',
  remover_comunicacao: 'Comunicação removida',
}

export const rotuloTipo = (tipo) => TIPOS_ATIVIDADE[tipo] || tipo

// Grava sem travar a tela: se o log falhar, o sistema segue normal.
// O banco exige usuario_email preenchido — se não veio, busca o da sessão.
export function registrarAtividade({ demo = false, usuario, tipo, detalhe = '', noticiaId = null }) {
  if (demo || !supabase) return
  const gravar = (email) => {
    if (!email) {
      console.warn('log de atividade pulado: e-mail do usuário desconhecido')
      return
    }
    supabase
      .from('atividades')
      .insert({ usuario_email: email, tipo, detalhe, noticia_id: noticiaId })
      .then(({ error }) => {
        if (error) console.warn(`log de atividade falhou: ${error.message}`)
      })
  }
  if (usuario) gravar(usuario)
  else supabase.auth.getUser().then(({ data }) => gravar(data?.user?.email ?? ''))
}
