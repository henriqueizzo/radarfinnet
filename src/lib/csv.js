// Exportação CSV feita 100% no navegador (Blob) — sem dependências.
// Formato pensado para o Excel brasileiro: separador ';' e BOM UTF-8
// (sem o BOM, o Excel abre os acentos embaralhados).

// Protege células com ';', aspas ou quebra de linha (regra do CSV)
function celula(valor) {
  const texto = String(valor ?? '')
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

// Monta o arquivo e dispara o download na hora.
// cabecalhos = ['Título', ...]; linhas = [['Resolução...', ...], ...]
export function baixarCsv({ nomeArquivo, cabecalhos, linhas }) {
  const conteudo = [cabecalhos, ...linhas]
    .map((linha) => linha.map(celula).join(';'))
    .join('\r\n')
  // '﻿' é o BOM — a marquinha invisível que avisa o Excel: "isto é UTF-8"
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
