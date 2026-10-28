# OIRAD Leitor

O diário OIRAD no telemóvel, **só para ler**: diário, sonhos e gratidão, com
pesquisa. Nada aqui escreve no Mac nem no Drive. Os ficheiros chegam ao
telemóvel como cópias, escolhidas à mão a partir do Drive, e a cópia fica
guardada no telemóvel cifrada com uma palavra-passe.

Endereço: https://antoniograzzawut.github.io/oirad-reader/

## Instalar no telemóvel (uma vez)

1. No telemóvel, abre o **Chrome** e vai a
   `antoniograzzawut.github.io/oirad-reader`.
2. Toca no botão **Instalar no ecrã principal**, por baixo de Continuar, e
   confirma. Aparece o ícone OIRAD junto das outras apps. O menu novo do Chrome
   (Julho de 2026) nem sempre tem a opção de instalar; o botão da página não
   depende dele. Se o botão não aparecer, a app funciona igual no separador do
   Chrome.
3. Abre a app pelo ícone. Escolhe uma palavra-passe (duas vezes).
4. Toca em **Escolher ficheiros**. No ecrã de escolha do Android, abre o menu
   **☰** (canto de cima, à esquerda) → **Drive** → **O meu disco** →
   **OIRAD Backup**. Não entres na pasta Snapshots.
5. Carrega sem largar em `OIRAD 2026 ' Janeiro.txt`, depois toca em
   `oirad-dreams.json` e `oirad-gratitude.json`, e confirma. Se não der para
   escolher vários de uma vez, escolhe um, volta a tocar em Escolher ficheiros
   e escolhe o seguinte: cada escolha junta-se às anteriores.
6. Os três aparecem com ✓. Toca em **Abrir**.

O Drive tem de estar instalado no telemóvel com a conta onde está o backup do
OIRAD; é por ele que o Android chega aos ficheiros.

## Usar

- **Diário, Sonhos, Grato**: os três separadores. O diário abre na entrada mais
  recente, como no Mac. **Anos** salta para um ano; a seta vai para o fim.
- **Lupa**: procura no separador aberto, sem ligar a acentos nem maiúsculas.
  As setas andam entre resultados.
- **⋯ Menu**: data da cópia, actualizar, aspecto, tamanho da letra, trancar.
- Tranca sozinha quando estás mais de um minuto fora da app.

**Actualizar a cópia**: menu → Actualizar a cópia do Drive → escolher os
ficheiros outra vez. A cópia não se actualiza sozinha. "Última entrada do
diário" no menu diz até onde a cópia chega.

**Aspecto**: três, todos tirados da app do Mac.
- **Original**: como o Mac está hoje, ambiente noite, datas em carimbo, régua vermelha.
- **Livro**: ambiente carvão, letra serifada, coluna de leitura centrada.
- **OIRAD.EXE**: ambiente meia-noite com as janelas Windows 95 do Mac.

**Esqueci-me da palavra-passe**: no ecrã de entrar, "Esqueci-me da
palavra-passe" apaga a cópia deste telemóvel. Escolhes outra palavra-passe e os
ficheiros outra vez. O diário no Mac e no Drive não é tocado.

## O que é público e o que não é

- Este repositório e a página são públicos: é só o código, sem uma linha do
  diário. Os ficheiros em `test/fixtures/` são inventados.
- O diário nunca sai do telemóvel. A página não tem como o enviar para lado
  nenhum: a regra de segurança no `index.html` (Content-Security-Policy) proíbe
  ligações a qualquer outro endereço.
- Guardado no telemóvel vai cifrado (AES-GCM, chave tirada da palavra-passe com
  PBKDF2). Sem a palavra-passe é ilegível.

## Para quem mexer no código

- `core.js`: a lógica, sem ecrã. O `parseOIRAD` é cópia exacta do da app do
  Mac (`oirad-app/index.html`); `npm test` compara os dois quando encontra a
  app do Mac ao lado.
- `app.js`: o ecrã. `index.html`: estrutura e os três aspectos (CSS).
- `sw.js`: guarda a app para abrir sem rede. `manifest.json`: o que torna a
  página instalável.
- `npm test`: testes com dados falsos. Nunca correr contra o diário verdadeiro.
- Publicar: `git push`. O GitHub Pages actualiza o endereço em um ou dois
  minutos; o telemóvel apanha a versão nova na segunda abertura.
