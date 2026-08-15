// Temas regulatórios que importam para a Finnet (IP autorizada na
// modalidade ITP, homologada no Open Finance/Pix). Cada notícia coletada
// ganha as etiquetas cujas palavras-chave aparecem no título ou resumo.
// As palavras estão SEM acento de propósito: o texto é normalizado antes.
const CATALOGO = {
  'Pix': ['pix', 'bolepix'],
  'Open Finance': ['open finance', 'open banking', 'iniciacao de pagamento', 'iniciador de pagamento', 'iniciadora de pagamento', 'consentimento'],
  'Instituições de Pagamento': ['instituicao de pagamento', 'instituicoes de pagamento', 'arranjo de pagamento', 'arranjos de pagamento', 'conta de pagamento'],
  'PLD/FT': ['lavagem de dinheiro', 'pld', 'siscoaf', 'coaf', 'financiamento do terrorismo', 'operacoes suspeitas'],
  'Duplicata Escritural': ['duplicata escritural', 'duplicatas escriturais', 'duplicata eletronica', 'registradora'],
  'Cobrança/Boleto': ['boleto', 'cobranca', 'dda', 'nuclea', 'recebiveis', 'antecipacao de recebiveis'],
  'LGPD': ['lgpd', 'dados pessoais', 'protecao de dados', 'anpd'],
  'Cibersegurança': ['seguranca cibernetica', 'ciberseguranca', 'incidente cibernetico', 'resiliencia operacional'],
}

export function detectarTemas(texto) {
  const alvo = ' ' + semAcentos(String(texto).toLowerCase()) + ' '
  const encontrados = []
  for (const [tema, palavras] of Object.entries(CATALOGO)) {
    const bateu = palavras.some((palavra) => new RegExp(`\\b${palavra}\\b`).test(alvo))
    if (bateu) encontrados.push(tema)
  }
  return encontrados
}

function semAcentos(texto) {
  // remove os acentos: 'ç' vira 'c', 'ã' vira 'a' (u0300–u036f são os acentos soltos)
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}
