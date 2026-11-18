// Análise automática de cada publicação da vertical Split Payment &
// Reforma Tributária. Tudo por palavras-chave no título (sem IA), para o
// time entender exatamente por que algo ganhou cada etiqueta.
//
// Por que essa priorização? A Finnet é EDI/VAN bancária: o que mais
// pesa é o banco mudar layout, arquivo ou API de cobrança/pagamento por
// causa do split payment, ou anunciar prazo/produto novo.
// As palavras estão SEM acento de propósito: o texto é normalizado antes.

export const ASSUNTOS = {
  'Split Payment': ['split payment', 'split', 'pagamento dividido', 'pagamento fracionado', 'recolhimento na liquidacao', 'recolhimento automatico', 'segregacao do tributo'],
  'Reforma Tributária': ['reforma tributaria', 'ibs', 'cbs', 'imposto seletivo', 'iva dual', 'iva', 'lc 214', 'lei complementar 214', 'plp 108', 'comite gestor', 'cgibs', 'nova tributacao sobre o consumo'],
}

// Documentação de layout dos bancos (CNAB, manuais técnicos, padrões
// Febraban). Só vale para o que o PRÓPRIO banco publica: na imprensa
// "leiaute" quase sempre é nota fiscal, não arquivo bancário.
// Termo FORTE basta sozinho. Termo FRACO ("layout", "especificação
// técnica") precisa vir junto de um contexto bancário, senão entra
// "novo layout da agência" ou "especificação técnica do cofre-forte".
export const LAYOUT_FORTE = ['cnab', '240 posicoes', '400 posicoes', '750 posicoes', '850 posicoes', '400 bytes', '240 bytes', 'padrao febraban', 'arquivo remessa', 'arquivo de remessa', 'arquivo retorno', 'arquivo de retorno', 'layout de arquivo', 'layout de arquivos', 'leiaute de arquivo', 'leiautes de arquivos', 'leiaute de arquivos', 'validador de layout', 'validador de leiaute', 'validador de leiautes']
export const LAYOUT_FRACO = ['layout', 'layouts', 'leiaute', 'leiautes', 'manual tecnico', 'manuais tecnicos', 'especificacao tecnica', 'especificacoes tecnicas', 'documentacao tecnica', 'manual de integracao']
export const LAYOUT_CONTEXTO = ['arquivo', 'arquivos', 'cobranca', 'pagamento', 'pagamentos', 'pix', 'boleto', 'boletos', 'remessa', 'retorno', 'extrato', 'debito automatico', 'deb aut', 'arrecadacao', 'recebimento', 'recebimentos', 'webservice', 'api', 'conciliacao', 'folha de pagamento', 'febraban', 'codigo de barras', 'validador', 'protesto', 'custodia', 'cheque', 'cheques', 'transferencia', 'ted', 'doc']

export const ASSUNTO_LAYOUT = 'Layout/Documentação'

export const SINAIS = {
  'Layout/Integração': ['layout', 'leiaute', 'cnab', 'api', 'apis', 'integracao', 'arquivo', 'arquivos', 'especificacao', 'manual tecnico', 'nota tecnica', 'homologacao', 'sistemas', 'tecnologia', 'infraestrutura', 'boleto', 'boletos', 'pix', 'cobranca', 'conciliacao'],
  'Prazo/Cronograma': ['prazo', 'prazos', 'cronograma', 'a partir de', 'comeca', 'inicio', 'piloto', 'fase de testes', 'fase de teste', 'periodo de teste', 'adia', 'adiamento', 'adiado', 'quando', 'calendario', 'transicao', '2026', '2027', '2033'],
  'Produto/Solução': ['lanca', 'lancamento', 'solucao', 'solucoes', 'plataforma', 'ferramenta', 'servico', 'parceria', 'novo produto', 'nova funcionalidade', 'oferece', 'disponibiliza'],
  'Regulamentação': ['lei complementar', 'regulamentacao', 'regulamento', 'portaria', 'resolucao', 'instrucao normativa', 'receita federal', 'comite gestor', 'cgibs', 'decreto', 'consulta publica', 'banco central', 'senado', 'camara'],
  'Orientação a clientes': ['guia', 'entenda', 'o que muda', 'o que e', 'como se preparar', 'como funciona', 'saiba', 'dicas', 'perguntas', 'tudo sobre', 'checklist', 'passo a passo'],
}

export function semAcentos(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// A palavra precisa aparecer inteira ("ibs" não bate em "ibsen")
function contem(alvo, palavra) {
  const escapada = palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escapada}($|[^a-z0-9])`).test(alvo)
}

function etiquetas(texto, catalogo) {
  const alvo = semAcentos(texto)
  return Object.entries(catalogo)
    .filter(([, palavras]) => palavras.some((p) => contem(alvo, p)))
    .map(([nome]) => nome)
}

export function ehLayout(texto) {
  const alvo = semAcentos(texto)
  const tem = (lista) => lista.some((p) => contem(alvo, p))
  return tem(LAYOUT_FORTE) || (tem(LAYOUT_FRACO) && tem(LAYOUT_CONTEXTO))
}

export const detectarAssuntos = (texto) => {
  const assuntos = etiquetas(texto, ASSUNTOS)
  if (ehLayout(texto)) assuntos.push(ASSUNTO_LAYOUT)
  return assuntos
}
export const detectarSinais = (texto) => etiquetas(texto, SINAIS)

// O título cita o banco? (variações sem acento, palavra inteira)
export function tituloCitaBanco(titulo, banco) {
  const alvo = semAcentos(titulo)
  const variacoes = banco.titulo ?? [semAcentos(banco.busca)]
  return variacoes.some((v) => contem(alvo, semAcentos(v)))
}

// Alta  → split payment com mexida técnica, prazo ou produto; ou split
//         publicado pelo próprio banco (fala direto com os clientes dele);
//         ou documentação de layout que já fala de split/reforma
// Média → qualquer coisa publicada pelo banco (inclui documentação de
//         layout), split na imprensa, ou regulamentação
// Baixa → o resto (reforma tributária em geral na imprensa)
export function calcularPrioridade({ assuntos, sinais, origem }) {
  const split = assuntos.includes('Split Payment')
  const doBanco = origem === 'Site do banco'
  const tecnico = sinais.some((s) => ['Layout/Integração', 'Prazo/Cronograma', 'Produto/Solução'].includes(s))
  const layoutTributario = assuntos.includes(ASSUNTO_LAYOUT) && (split || assuntos.includes('Reforma Tributária'))
  if (split && (tecnico || doBanco)) return 'Alta'
  if (layoutTributario) return 'Alta'
  if (doBanco || split || sinais.includes('Regulamentação')) return 'Média'
  return 'Baixa'
}

// Publicação antiga (achada na primeira varredura ou indexada com atraso)
// entra como "Histórico" para não poluir a fila de novidades.
export const DIAS_NOVIDADE = 15

export function statusInicial(dataPublicacao, agora = Date.now()) {
  if (!dataPublicacao) return 'Novo'
  const dias = (agora - new Date(dataPublicacao).getTime()) / 86400000
  return dias > DIAS_NOVIDADE ? 'Histórico' : 'Novo'
}
