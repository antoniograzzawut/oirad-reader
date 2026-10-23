// Aplica o aspecto e o tamanho de letra escolhidos antes do primeiro desenho, para não piscar.
try {
  var look = localStorage.getItem('oirad-leitor-look')
  if (look) document.documentElement.dataset.look = look
  var scale = localStorage.getItem('oirad-leitor-scale')
  if (scale) document.documentElement.style.setProperty('--scale', scale)
} catch (e) {}
