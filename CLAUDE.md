# OIRAD Leitor

Leitor do diário OIRAD para o telemóvel (Android, Chrome, instalado como app).
Nível 1 do plano de 23 Out 2026: só ler. O contexto está no vault, nota
`~/Antoine/Projects/OIRAD.md`. Instruções de uso no README.

## Regras

- **Só lê.** Não acrescentar nenhum caminho que escreva no Drive, no Mac ou em
  ficheiros. Escrever é o nível 2, e é decisão do António, não de uma sessão.
- **Nunca dados verdadeiros no repositório.** É público. `test/fixtures/` só
  tem texto inventado.
- **O parser é do Mac.** `parseOIRAD` em `core.js` é cópia exacta do de
  `oirad-app/index.html`. Se o Mac mudar, copiar outra vez; `npm test` acusa a
  diferença.
- **Sem ligações para fora.** A CSP no `index.html` só deixa a página falar com
  o próprio endereço. Não abrir excepções (fontes, CDNs, análise de tráfego).
- **A cópia no telemóvel vai sempre cifrada.** Nunca guardar o diário em claro
  no IndexedDB nem no localStorage.
- Ao mudar ficheiros da app, mudar também `CACHE` em `sw.js` só se a lista
  `SHELL` mudar; o resto actualiza-se sozinho.
