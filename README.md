# OIRAD Leitor

O diário OIRAD no telemóvel: ler o diário, os sonhos e a gratidão, com
pesquisa, e escrever entradas, sonhos e gratidão novos. **Nada aqui muda o
diário.** Os ficheiros chegam ao telemóvel como cópias, escolhidas à mão a
partir do Drive, e a cópia fica guardada no telemóvel cifrada com uma
palavra-passe. O que escreves vai, quando carregas em Enviar, para uma pasta à
parte no Drive (`OIRAD Inbox`), e só entra no diário quando o juntares no Mac.

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

**Para escrever, mais uma coisa, uma vez:** na app Drive do telemóvel, toca em
**+** → **Pasta** → nome `OIRAD Inbox` → **Criar**. Cria-a em **O meu disco**,
fora da pasta OIRAD Backup.

## Usar

- **Diário, Sonhos, Grato**: os três separadores. O diário abre na entrada mais
  recente, como no Mac. **Anos** salta para um ano; a seta vai para o fim.
- **Lupa**: procura no separador aberto, sem ligar a acentos nem maiúsculas.
  As setas andam entre resultados.
- **Lápis**: escrever. Ver em baixo.
- **⋯ Menu**: data da cópia, actualizar, aspecto, tamanho da letra, trancar.
- Tranca sozinha quando estás mais de um minuto fora da app.

**Escrever**: lápis → escolhe **Entrada**, **Sonho** ou **Grato** → escreve
(data e hora já vêm preenchidas, podes mudá-las) → **Enviar para o Drive** →
no menu de partilha do Android escolhe **Drive** → muda a pasta para
**OIRAD Inbox** → **Guardar**. Cada texto vai como um ficheiro `.txt` pequeno.
- Entrada sai no formato exacto do diário (data, linha vazia, hora, local,
  texto), pronta a colar.
- Gratidão pede as três, como no Mac.
- O que escreves fica também numa lista neste telemóvel ("Escrito neste
  telemóvel"), cifrado, até o apagares, com o estado de cada um: por enviar,
  enviado ou copiado. Daí podes reenviar, copiar ou apagar.
- **Copiar texto** é a alternativa ao Drive: copia e colas onde quiseres.
- O rascunho guarda-se sozinho enquanto escreves. Se a app trancar a meio, ao
  voltar está lá.
- O ponto vermelho no lápis quer dizer que há texto por enviar ou copiar.
- Apagar a cópia do telemóvel (menu, ou "Esqueci-me da palavra-passe") apaga
  também esta lista; se houver texto por enviar, a pergunta avisa.

**Lembretes**: notificações a horas marcadas (sonhos 9:30, grato 22:30,
entrada ao domingo 19:00). Tocar abre a app, pede a palavra-passe e vai direito
à escrita certa. Ligar, uma vez: menu → **Ligar lembretes** → permitir → **Copiar
código para o Claude** → colar na conversa com o Claude, que o põe no
agendador. Quem envia é um repositório privado,
`antoniograzzawut/oirad-reminders`, que corre no GitHub a essas horas. Desligar:
carrega sem largar numa notificação e desliga-as no Android.

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
- As notificações dos lembretes chegam pelo serviço de notificações do Chrome
  e trazem só o tipo e o texto do lembrete ("Três coisas de hoje."), cifrados
  para este telemóvel. Nada do diário vai nelas, e a página não envia nada
  para lado nenhum para as receber.
- O que escreves só sai quando carregas em Enviar ou Copiar, e sai pelo menu
  de partilha do Android, para onde tu escolheres. A página não fala com o
  Drive directamente nem pede login no Google.
- Guardado no telemóvel vai cifrado (AES-GCM, chave tirada da palavra-passe com
  PBKDF2), a cópia do diário e a lista do que escreveste. Sem a palavra-passe é
  ilegível.

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
