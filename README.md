# 📡 Radar Regulatório · Finnet

Sistema que mantém o time de **Regulação, Governança e Compliance** atualizado:

- **📰 Feed de novidades** — notícias e normativos do Banco Central, Coaf,
  Febraban, Open Finance Brasil e DOU, coletados automaticamente e
  etiquetados com os temas que importam para a Finnet (Pix, Open Finance,
  PLD/FT, duplicata escritural…).
- **🎯 Radar de mudanças** — quadro kanban onde cada mudança regulatória
  avança pelos status **Encontrado → Avaliando → Desenvolvimento → Entregue**,
  com responsável, observações e histórico de quem moveu.

## Como funciona

```
🤖 coletor/            robô em Node — roda a cada 3h no GitHub Actions
        ↓ grava (sem duplicar)
🗄️ Supabase            banco de dados + login da equipe
        ↓ lê
🖥️ src/                site em React com a UX Finnet
```

## Para começar

O passo a passo completo (criar o Supabase, rodar o banco, subir o robô)
está em **[docs/COMO-CONFIGURAR.md](docs/COMO-CONFIGURAR.md)**.

Atalhos do dia a dia:

| Comando | O que faz |
|---|---|
| `npm run dev` | abre o site no seu PC |
| `npm run coletar:teste` | testa as 5 fontes SEM gravar no banco |
| `npm run coletar` | coleta e grava no banco (precisa de credenciais) |
| `npm run deploy` | publica o site no GitHub Pages |

As fontes de dados (URLs de APIs e feeds, todas verificadas) estão
documentadas em [docs/fontes-de-dados.md](docs/fontes-de-dados.md).
