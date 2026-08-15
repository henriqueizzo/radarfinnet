// Gera docs/documentacao-tecnica.html a partir de docs/_fonte-documentacao.html,
// embutindo as fontes woff2 como data URI (o Artifact bloqueia CDN de fontes).
import { readFileSync, writeFileSync } from 'node:fs'

const FONTES = 'C:/Users/4Gamers/LicitaFinnet/LicitaFinnet - Copia/frontend/public/fonts'
const b64 = (arquivo) => readFileSync(`${FONTES}/${arquivo}`).toString('base64')

const html = readFileSync('docs/_fonte-documentacao.html', 'utf8')
  .replace('/*FONT_500*/', b64('chakra-petch-500.woff2'))
  .replace('/*FONT_600*/', b64('chakra-petch-600.woff2'))

if (html.includes('/*FONT_')) {
  console.error('ERRO: sobrou placeholder de fonte no HTML')
  process.exit(1)
}

writeFileSync('docs/documentacao-tecnica.html', html)
console.log(`OK — documentacao-tecnica.html gerado (${(html.length / 1024).toFixed(0)} KB)`)
