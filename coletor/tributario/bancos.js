// Bancos e instituições integrados à Finnet acompanhados na vertical
// Split Payment & Reforma Tributária (lista enviada pelo time em 12/11/2026).
//
// Para cada instituição:
//   nome     → como aparece na tela
//   busca    → nome usado na busca de notícias (entre aspas no Google News)
//   titulo   → variações que precisam aparecer no TÍTULO da notícia para
//              ela ser atribuída ao banco (evita falso positivo: matéria
//              genérica sobre reforma que só cita o banco no meio do texto).
//              Sem acento e em minúsculas. Se omitido, usa a própria busca.
//   dominios → sites oficiais; o robô busca o que o PRÓPRIO banco publica
//              neles (blog, portal, central de ajuda). Domínios conferidos
//              em 12/11/2026. Vazio = instituição sem site localizado.
//
// Linhas repetidas da lista original foram unificadas (Banco Creditise
// aparecia 2 vezes; "Banco HSBC SA" e "HSBC Bank Brasil" viraram uma só).
export const BANCOS = [
  { nome: 'Banco do Brasil', busca: 'Banco do Brasil', dominios: ['bb.com.br'] },
  { nome: 'Banco do Nordeste', busca: 'Banco do Nordeste', titulo: ['banco do nordeste', 'bnb'], dominios: ['bnb.gov.br'] },
  { nome: 'Banestes', busca: 'Banestes', dominios: ['banestes.com.br'] },
  { nome: 'Banco Alfa', busca: 'Banco Alfa', dominios: ['bancoalfa.com.br'] },
  { nome: 'Santander', busca: 'Santander', dominios: ['santander.com.br'] },
  { nome: 'Banrisul', busca: 'Banrisul', dominios: ['banrisul.com.br'] },
  { nome: 'Banco Inter', busca: 'Banco Inter', titulo: ['banco inter', 'inter&co', 'inter empresas'], dominios: ['inter.co'] },
  { nome: 'Sisprime do Brasil', busca: 'Sisprime', dominios: ['sisprimedobrasil.com.br'] },
  { nome: 'Ailos', busca: 'Ailos', dominios: ['ailos.coop.br'] },
  { nome: 'ML Bank II FIDC', busca: 'ML Bank', dominios: [] },
  { nome: 'Caixa Econômica Federal', busca: 'Caixa Econômica Federal', titulo: ['caixa economica', 'caixa federal'], dominios: ['caixa.gov.br'] },
  { nome: 'Banco BOCOM BBM', busca: 'BOCOM BBM', titulo: ['bocom bbm', 'banco bbm'], dominios: ['bocombbm.com.br'] },
  { nome: 'Unicred', busca: 'Unicred', dominios: ['unicred.com.br'] },
  { nome: 'Banco Creditise', busca: 'Creditise', dominios: [] },
  { nome: 'BTG Pactual', busca: 'BTG Pactual', titulo: ['btg'], dominios: ['btgpactual.com'] },
  { nome: 'Banco Original', busca: 'Banco Original', dominios: ['original.com.br'] },
  { nome: 'Banco BS2', busca: 'Banco BS2', titulo: ['bs2'], dominios: ['bancobs2.com.br'] },
  { nome: 'Banco Fibra', busca: 'Banco Fibra', dominios: ['bancofibra.com.br'] },
  { nome: 'Multiplica FIDC', busca: 'Multiplica FIDC', titulo: ['multiplica'], dominios: [] },
  { nome: 'Bradesco', busca: 'Bradesco', dominios: ['bradesco.com.br', 'banco.bradesco'] },
  { nome: 'Banco ABC Brasil', busca: 'ABC Brasil', dominios: ['abcbrasil.com.br'] },
  { nome: 'HSBC Brasil', busca: 'HSBC', dominios: ['hsbc.com.br'] },
  { nome: 'China Construction Bank Brasil', busca: 'China Construction Bank', titulo: ['china construction bank', 'ccb brasil'], dominios: [] },
  { nome: 'Quatá Investimentos', busca: 'Quatá', titulo: ['quata'], dominios: ['quata.com.br'] },
  { nome: 'Banco C6', busca: 'C6 Bank', titulo: ['c6 bank', 'banco c6', 'c6'], dominios: ['c6bank.com.br'] },
  { nome: 'Itaú Unibanco', busca: 'Itaú', titulo: ['itau'], dominios: ['itau.com.br'] },
  { nome: 'Banco Mercantil do Brasil', busca: 'Banco Mercantil', titulo: ['mercantil'], dominios: ['bancomercantil.com.br'] },
  { nome: 'Banco Safra', busca: 'Safra', dominios: ['safra.com.br'] },
  { nome: 'MUFG Brasil', busca: 'MUFG', dominios: [] },
  { nome: 'Deutsche Bank Brasil', busca: 'Deutsche Bank', dominios: [] },
  { nome: 'ASA Investments', busca: 'ASA Investments', titulo: ['asa investments', 'asa'], dominios: ['asa.com.br'] },
  { nome: 'Banco Industrial do Brasil', busca: 'Banco Industrial do Brasil', titulo: ['banco industrial', 'bib'], dominios: ['bib.com.br'] },
  { nome: 'Banco Paulista', busca: 'Banco Paulista', dominios: ['bancopaulista.com.br'] },
  { nome: 'Banco Rendimento', busca: 'Banco Rendimento', titulo: ['rendimento'], dominios: ['rendimento.com.br'] },
  { nome: 'Banco Sofisa', busca: 'Sofisa', dominios: ['sofisa.com.br'] },
  { nome: 'Banco Pine', busca: 'Banco Pine', dominios: ['pine.com'] },
  { nome: 'Banco Voiter', busca: 'Voiter', dominios: [] },
  { nome: 'Banco BV (Votorantim)', busca: 'banco BV', titulo: ['banco bv', 'votorantim'], dominios: ['bv.com.br'] },
  { nome: 'Banco Daycoval', busca: 'Daycoval', dominios: ['daycoval.com.br'] },
  { nome: 'Citibank', busca: 'Citi Brasil', titulo: ['citi', 'citibank'], dominios: ['citibank.com.br'] },
  { nome: 'Sicredi', busca: 'Sicredi', dominios: ['sicredi.com.br'] },
  { nome: 'BNP Paribas Brasil', busca: 'BNP Paribas', dominios: ['bnpparibas.com.br'] },
  { nome: 'Bank of America Brasil', busca: 'Bank of America', titulo: ['bank of america', 'bofa'], dominios: [] },
  { nome: 'Sicoob', busca: 'Sicoob', dominios: ['sicoob.com.br'] },
  { nome: 'Red Asset', busca: 'Red Asset', titulo: ['red asset', 'redasset'], dominios: ['redasset.com.br'] },
  { nome: 'Banco Lotus', busca: 'Banco Lotus', dominios: [] },
  { nome: 'Brickell Fomento Mercantil', busca: 'Brickell Fomento', titulo: ['brickell'], dominios: [] },
  { nome: 'Opea Securitizadora', busca: 'Opea Securitizadora', titulo: ['opea'], dominios: ['opea.com.br'] },
  { nome: 'CVPar Finanças', busca: 'CVPar', dominios: [] },
  { nome: 'Gávea Sul FIDC', busca: 'Gávea Sul', titulo: ['gavea sul'], dominios: [] },
  { nome: 'Asia LP', busca: 'Asia LP', dominios: [] },
  { nome: 'Lecca Financeira', busca: 'Lecca', dominios: ['lecca.com.br'] },
  { nome: 'Crescer Fomento Comercial', busca: 'Crescer Crédito', titulo: ['crescer credito', 'crescer fomento'], dominios: ['crescercredito.com.br'] },
  { nome: 'Multiplike Securitizadora', busca: 'Multiplike', dominios: [] },
  { nome: 'Garson Fundo de Investimento', busca: 'Garson', dominios: [] },
  { nome: 'Amplic', busca: 'Amplic', dominios: ['amplic.com.br'] },
  { nome: 'Sifra', busca: 'Sifra', dominios: ['sifra.com.br'] },
  // Associação dos bancos: é por ela que saem os padrões técnicos do
  // split payment combinados entre as instituições
  { nome: 'Febraban (setor bancário)', busca: 'Febraban', dominios: ['febraban.org.br'], extra: true },
  // Matérias de mercado sobre split payment que não citam um banco
  // específico no título (cronograma, cobertura, mudanças na lei…).
  // Aqui só entra o que fala de SPLIT PAYMENT, não reforma em geral.
  {
    nome: 'Mercado (split payment)',
    consulta: '"split payment" (banco OR bancos OR pagamentos OR Febraban OR "Banco Central") when:30d',
    geral: true,
    extra: true,
    dominios: [],
  },
]

// Só as instituições da lista da Finnet (sem Febraban e mercado)
export const NOMES_BANCOS = BANCOS.filter((b) => !b.extra).map((b) => b.nome)
