# OIRAD Leitor

Leitor do diário OIRAD para o telemóvel (Android, Chrome, instalado como app).
Nível 1 do plano de 23 Out 2026 (ler) e, desde 28 Out 2026, o lado do
telemóvel do nível 2 (escrever para uma pasta à parte no Drive). O contexto
está no vault, nota `~/Antoine/Projects/OIRAD.md`. Instruções de uso no README.

## Regras

- **Nunca muda o diário.** Ler não escreve nada. Escrever (decidido pelo
  António a 28 Out 2026) só cria ficheiros `.txt` que ele próprio entrega, ao
  carregar em Enviar, ao menu de partilha do Android, para a pasta
  `OIRAD Inbox` do Drive (nunca `OIRAD Backup`). Sem login no Google, sem a
  página falar com o Drive. Juntar ao diário é sempre no Mac, pelo caminho
  guardado da app (ponto 2, ainda não feito nem pedido).
- **Um texto escrito nunca se perde em silêncio.** Fica na lista cifrada até ele
  o apagar; apagar o que está por enviar pede confirmação com aviso. Se a lista
  guardada não abrir, não se escreve por cima dela (`outboxLocked`).
- **Partilhar só ficheiros `.txt`.** O Chrome no Android não deixa partilhar
  `.json`. A entrada sai no formato exacto que a Nova Entrada do Mac grava
  (`captureText` em `core.js`, testado contra `parseOIRAD`).
- **Nunca dados verdadeiros no repositório.** É público. `test/fixtures/` só
  tem texto inventado.
- **O parser é do Mac.** `parseOIRAD` em `core.js` é cópia exacta do de
  `oirad-app/index.html`. Se o Mac mudar, copiar outra vez; `npm test` acusa a
  diferença.
- **Sem ligações para fora.** A CSP no `index.html` só deixa a página falar com
  o próprio endereço. Não abrir excepções (fontes, CDNs, análise de tráfego).
- **A cópia no telemóvel vai sempre cifrada.** Nunca guardar o diário nem o
  que se escreve em claro no IndexedDB nem no localStorage. Em claro só fica o
  número de textos por enviar (`outboxMeta`), para o aviso de apagar.
- Ao mudar ficheiros da app, mudar também `CACHE` em `sw.js` só se a lista
  `SHELL` mudar; o resto actualiza-se sozinho.
