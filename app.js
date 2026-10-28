// OIRAD Leitor: o ecrã. Não existe aqui nenhum caminho que escreva no diário,
// no Drive ou no Mac por conta própria: os ficheiros chegam pelo selector do
// Android como cópias, o que se escreve só sai quando o António carrega em
// Enviar (menu de partilha do Android), e o que fica guardado vive só neste
// telemóvel, cifrado com a palavra-passe.
(() => {
'use strict'
const C = window.OiradCore
const $ = id => document.getElementById(id)
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const LOCK_AFTER_MS = 60 * 1000
const MAX_MARKS = 3000
const TABS = ['diary', 'dreams', 'gratitude']
const LOOKS = [
  { id: 'original', label: 'Original', bar: '#111118' },
  { id: 'livro', label: 'Livro', bar: '#141210' },
  { id: 'exe', label: 'OIRAD.EXE', bar: '#000080' },
]
const SCALES = [0.85, 0.92, 1, 1.08, 1.16, 1.26, 1.38]

// ── GUARDAR NESTE TELEMÓVEL (IndexedDB, sempre cifrado) ───────────────────────
const DB_NAME = 'oirad-leitor'
const STORE = 'kv'
function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
async function kv(mode, fn) {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(req.result) }
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error) }
  })
}
const kvGet = k => kv('readonly', s => s.get(k))
const kvSet = (k, v) => kv('readwrite', s => s.put(v, k))
const kvDel = k => kv('readwrite', s => s.delete(k))

// Preferências de ecrã (aspecto, tamanho). Se o browser as perder, volta ao normal.
function pref(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k)
    localStorage.setItem(k, v)
  } catch { return null }
}

// ── ESTADO ────────────────────────────────────────────────────────────────────
let key = null       // chave de decifrar; só existe em memória enquanto está destrancado
let vault = null     // o que está guardado: sal, iterações, cópia cifrada
let data = null      // a cópia decifrada: { diary, dreams, gratitude, importedAt }
let pending = null   // ficheiros escolhidos no ecrã de escolha, ainda por guardar
let tab = 'diary'
let years = {}
const html = {}      // HTML de cada separador sem marcas de pesquisa
let hiddenAt = 0
let outbox = emptyOutbox() // o que se escreveu aqui: { items, draft }, guardado cifrado
let outboxLocked = false   // a lista guardada não abriu: não se escreve por cima dela
let shareGraceUntil = 0    // enviar abre o Drive, que pode demorar: não trancar a meio
let sharing = false
let pendingWrite = null    // um lembrete pediu para abrir a escrita: abre depois de destrancar

function show(name) {
  for (const s of ['lock', 'setup', 'import', 'app', 'write']) $('scr-' + s).hidden = s !== name
}
function say(id, text) { $(id).textContent = text || '' }
async function busy(btn, label, fn) {
  const old = btn.textContent
  btn.disabled = true
  btn.textContent = label
  await new Promise(r => setTimeout(r, 30)) // deixa aparecer o "a abrir…" antes do trabalho pesado
  try { return await fn() } finally { btn.disabled = false; btn.textContent = old }
}
function toast(text) {
  const t = $('toast')
  t.textContent = text
  t.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => { t.hidden = true }, 8000)
}
const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

// ── ARRANQUE ──────────────────────────────────────────────────────────────────
async function boot() {
  applyLook(currentLook())
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {})
  const want = new URLSearchParams(location.search).get('escrever')
  if (C.KINDS.includes(want)) pendingWrite = want
  if (location.search) history.replaceState(null, '', location.pathname)
  if (!window.crypto || !crypto.subtle) {
    show('setup')
    $('setup-go').disabled = true
    say('setup-msg', 'Este browser não consegue cifrar. Abre o endereço que começa por https.')
    return
  }
  try { vault = await kvGet('vault') } catch { vault = null }
  if (vault && vault.ct) show('lock')
  else { vault = null; show('setup') }
}

// ── PRIMEIRA VEZ: PALAVRA-PASSE ───────────────────────────────────────────────
$('setup-form').addEventListener('submit', async e => {
  e.preventDefault()
  const a = $('setup-pw').value
  const b = $('setup-pw2').value
  if (a.length < 4) return say('setup-msg', 'Pelo menos 4 caracteres.')
  if (a !== b) return say('setup-msg', 'As duas não são iguais.')
  say('setup-msg')
  await busy($('setup-go'), 'A preparar…', async () => {
    const salt = C.newSalt()
    key = await C.deriveKey(a, salt, C.ITER)
    vault = { v: 1, iter: C.ITER, salt }
  })
  $('setup-pw').value = ''
  $('setup-pw2').value = ''
  data = { diary: null, dreams: null, gratitude: null }
  outbox = emptyOutbox()
  outboxLocked = false
  openImport(false)
  // Pedir ao Android para não apagar a cópia quando faltar espaço. Pode recusar; se recusar, escolhe-se outra vez.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {})
})

// Um aviso só vale para a tentativa que o causou: apaga-se assim que se volta a escrever.
for (const id of ['setup-pw', 'setup-pw2']) $(id).addEventListener('input', () => say('setup-msg'))
$('lock-pw').addEventListener('input', () => say('lock-msg'))

// ── ESCOLHER FICHEIROS ────────────────────────────────────────────────────────
function openImport(canCancel) {
  pending = { diary: data.diary, dreams: data.dreams, gratitude: data.gratitude }
  $('import-cancel').hidden = !canCancel
  renderImport([])
  show('import')
}

function renderImport(notes) {
  const rows = [
    ['Diário', pending.diary && `${pending.diary.name} · ${C.countEntries(pending.diary.text)} entradas`, "OIRAD 2026 ' Janeiro.txt"],
    ['Sonhos', pending.dreams && `${pending.dreams.name} · ${C.dreamList(pending.dreams.data).length} sonhos`, 'oirad-dreams.json'],
    ['Gratidão', pending.gratitude && `${pending.gratitude.name} · ${C.gratitudeList(pending.gratitude.data).length} dias`, 'oirad-gratitude.json'],
  ]
  $('import-list').innerHTML = rows.map(([k, got, want]) =>
    `<li><span class="k">${k}</span><span class="v${got ? '' : ' missing'}">${got ? '✓ ' + esc(got) : esc(want)}</span></li>`).join('')
  $('import-notes').innerHTML = notes.map(n => `<li>${esc(n)}</li>`).join('')
  $('import-done').disabled = !(pending.diary || pending.dreams || pending.gratitude)
}

$('pick-btn').addEventListener('click', () => $('file-input').click())

$('file-input').addEventListener('change', async e => {
  const files = [...e.target.files]
  e.target.value = ''
  const notes = []
  let diaryThisPick = null
  for (const f of files) {
    let text
    try { text = await f.text() } catch { notes.push(`${f.name}: não consegui ler o ficheiro`); continue }
    const r = C.classifyFile(f.name, text)
    if (r.kind === 'diary') {
      // Dois diários na mesma escolha: fica o maior, e diz-se qual ficou de fora.
      if (diaryThisPick && diaryThisPick.text.length >= text.length) { notes.push(`${f.name}: ficou de fora, escolheste dois diários e fiquei com o maior`); continue }
      if (diaryThisPick) notes.push(`${diaryThisPick.name}: ficou de fora, escolheste dois diários e fiquei com o maior`)
      diaryThisPick = pending.diary = { name: f.name, text }
    } else if (r.kind === 'dreams') pending.dreams = { name: f.name, data: r.data }
    else if (r.kind === 'gratitude') pending.gratitude = { name: f.name, data: r.data }
    else notes.push(`${f.name}: ${r.reason}`)
  }
  renderImport(notes)
})

$('import-done').addEventListener('click', async () => {
  data = { diary: pending.diary, dreams: pending.dreams, gratitude: pending.gratitude, importedAt: Date.now() }
  pending = null
  let saved = true
  await busy($('import-done'), 'A guardar…', async () => {
    try {
      const { iv, ct } = await C.seal(key, data)
      const next = { v: 1, iter: vault.iter, salt: vault.salt, iv, ct, savedAt: Date.now() }
      await kvSet('vault', next)
      vault = next
    } catch { saved = false }
  })
  enterApp()
  if (!saved) toast('Não consegui guardar a cópia neste telemóvel. Dá para ler agora, mas da próxima vez vais ter de escolher os ficheiros outra vez.')
})

$('import-cancel').addEventListener('click', () => { pending = null; show('app') })

// ── TRANCAR E DESTRANCAR ──────────────────────────────────────────────────────
$('lock-form').addEventListener('submit', async e => {
  e.preventDefault()
  const pw = $('lock-pw').value
  if (!pw) return
  say('lock-msg')
  let ok = false
  await busy($('lock-go'), 'A abrir…', async () => {
    try {
      const k = await C.deriveKey(pw, vault.salt, vault.iter)
      data = await C.unseal(k, vault.iv, vault.ct)
      await openOutbox(k)
      key = k
      ok = true
    } catch { data = null }
  })
  if (!ok) return say('lock-msg', 'Palavra-passe errada.')
  $('lock-pw').value = ''
  enterApp()
})

$('lock-forgot').addEventListener('click', async () => {
  let unsent = 0
  try { const m = await kvGet('outboxMeta'); unsent = (m && m.unsent) || 0 } catch {}
  const warn = unsent ? `\n\nATENÇÃO: ${unsent === 1 ? 'há 1 texto escrito' : `há ${unsent} textos escritos`} neste telemóvel que não foi enviado nem copiado. Perde-se.` : ''
  if (confirm(`Apagar a cópia guardada neste telemóvel?${warn}\n\nO diário no Mac e no Drive não é tocado. Depois escolhes uma palavra-passe nova e os ficheiros outra vez.`)) wipe()
})

function lock() {
  if (!$('scr-write').hidden) stashDraft()
  key = null
  data = null
  outbox = emptyOutbox()
  dropOverlays()
  closeSheet(true)
  closeSearch(true)
  clearViews()
  clearWriteForm()
  if (vault && vault.ct) show('lock')
  else { vault = null; show('setup') }
}

async function wipe() {
  try { await kvDel('vault') } catch {}
  try { await kvDel('outbox'); await kvDel('outboxMeta') } catch {}
  key = null
  vault = null
  data = null
  outbox = emptyOutbox()
  outboxLocked = false
  clearViews()
  clearWriteForm()
  show('setup')
}

// Fora da app mais de um minuto, tranca. Enquanto está fora, tapa o ecrã
// (para o diário não aparecer na lista de apps recentes). Só a ler ou a escrever:
// escolher ficheiros também sai da app, e isso não pode trancar a meio. Nem
// enviar para o Drive, que abre outra app e pode demorar.
document.addEventListener('visibilitychange', () => {
  const inside = !$('scr-app').hidden || !$('scr-write').hidden
  if (document.hidden) {
    hiddenAt = Date.now()
    if (inside) document.documentElement.classList.add('veiled')
    if (!$('scr-write').hidden) stashDraft()
    return
  }
  const sending = sharing || Date.now() < shareGraceUntil
  if (!sharing) shareGraceUntil = 0 // a folga do envio serve para um regresso, não mais
  if (inside && key && !sending && Date.now() - hiddenAt > LOCK_AFTER_MS) lock()
  document.documentElement.classList.remove('veiled')
})

// ── LER ───────────────────────────────────────────────────────────────────────
function emptyState(text, withPick) {
  return `<div class="empty"><span>${esc(text)}</span>${withPick ? '<button class="btn" type="button" data-act="import">Escolher ficheiros</button>' : ''}</div>`
}

function buildViews() {
  const d = data.diary
  if (d) {
    const r = C.parseOIRAD(d.text)
    const last = C.lastEntryDate(d.text)
    years = r.years
    html.diary = `<article class="doc">${r.html}<div class="doc-end">fim da cópia${last ? ' · última entrada ' + C.fmtDate(last) : ''}</div></article>`
  } else {
    years = {}
    html.diary = emptyState('Ainda não escolheste o diário.', true)
  }

  const dl = data.dreams ? C.dreamList(data.dreams.data) : null
  html.dreams = !dl ? emptyState('Ainda não escolheste os sonhos.', true)
    : !dl.length ? emptyState('Sem sonhos registados.')
    : `<div class="list"><div class="list-head">${dl.length} sonhos</div>` + dl.map(({ key: k, data: x }) =>
      `<div class="day"><div class="day-date">${esc(C.keyLabel(k))}${x.time ? ' · ' + esc(x.time) : ''}</div>` +
      `<div class="day-text">${esc(x.entry).replace(/\n/g, '<br>')}</div></div>`).join('') + '</div>'

  const gl = data.gratitude ? C.gratitudeList(data.gratitude.data) : null
  html.gratitude = !gl ? emptyState('Ainda não escolheste a gratidão.', true)
    : !gl.length ? emptyState('Sem registos de gratidão.')
    : `<div class="list"><div class="list-head">${gl.length} dias</div>` + gl.map(({ key: k, data: x }) =>
      `<div class="day"><div class="day-date">${esc(C.keyLabel(k))}${x.time ? ' · ' + esc(x.time) : ''}</div>` +
      x.entries.filter(e => typeof e === 'string' && e.trim()).map((e, i) =>
        `<div class="grat-item"><span class="grat-n">${i + 1}</span><span class="day-text">${esc(e)}</span></div>`).join('') +
      '</div>').join('') + '</div>'

  for (const t of TABS) $('view-' + t).innerHTML = html[t]
}

function clearViews() {
  for (const t of TABS) { $('view-' + t).innerHTML = ''; html[t] = '' }
  years = {}
  marks = []
  cur = -1
}

function enterApp() {
  buildViews()
  show('app')
  updatePendingDot()
  selectTab(tab)
  // Abre no fim do diário, na entrada mais recente, como no Mac.
  requestAnimationFrame(() => { const v = $('view-diary'); v.scrollTop = v.scrollHeight })
  if (pendingWrite) { const k = pendingWrite; pendingWrite = null; openWrite(k) }
}

function selectTab(t) {
  tab = t
  for (const x of TABS) $('view-' + x).classList.toggle('on', x === t)
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t))
  $('fab').hidden = t !== 'diary' || !data || !data.diary
  if (query) runSearch()
}

$('tabs').addEventListener('click', e => {
  const b = e.target.closest('.tab')
  if (b) selectTab(b.dataset.tab)
})
$('views').addEventListener('click', e => {
  if (e.target.closest('[data-act="import"]')) openImport(true)
})

// ── PESQUISA ──────────────────────────────────────────────────────────────────
// No separador aberto, sem acentos nem maiúsculas. Cada mudança de texto
// redesenha o separador limpo e marca de novo, o que evita marcas órfãs.
let query = ''
let marks = []
let cur = -1
let searchTimer = 0

function openSearch() {
  $('bar-top').hidden = true
  $('bar-search').hidden = false
  $('q').focus()
  pushOverlay('search')
}

function closeSearch(fromBack) {
  if ($('bar-search').hidden) return
  $('bar-search').hidden = true
  $('bar-top').hidden = false
  $('q').value = ''
  query = ''
  clearMarks()
  if (!fromBack) popOverlay('search')
}

function clearMarks() {
  for (const t of TABS) {
    const v = $('view-' + t)
    if (!v.querySelector('mark')) continue
    const top = v.scrollTop
    v.innerHTML = html[t]
    v.scrollTop = top
  }
  marks = []
  cur = -1
  $('q-count').textContent = ''
}

function runSearch() {
  clearMarks()
  const needle = C.fold(query.trim())
  if (needle.length < 2) return
  const v = $('view-' + tab)
  const walker = document.createTreeWalker(v, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const node of nodes) {
    if (marks.length >= MAX_MARKS) break
    const s = node.nodeValue
    const hits = C.findAll(s, needle)
    if (!hits.length) continue
    const frag = document.createDocumentFragment()
    let pos = 0
    for (const [a, b] of hits) {
      if (marks.length >= MAX_MARKS) break
      if (a > pos) frag.appendChild(document.createTextNode(s.slice(pos, a)))
      const m = document.createElement('mark')
      m.textContent = s.slice(a, b)
      frag.appendChild(m)
      marks.push(m)
      pos = b
    }
    if (pos < s.length) frag.appendChild(document.createTextNode(s.slice(pos)))
    node.parentNode.replaceChild(frag, node)
  }
  if (!marks.length) { $('q-count').textContent = '0'; return }
  // O diário tem o mais antigo em cima: começa pela ocorrência mais recente. Nas listas, pela primeira.
  goToMark(tab === 'diary' ? marks.length - 1 : 0)
}

function goToMark(i) {
  if (marks[cur]) marks[cur].classList.remove('cur')
  cur = (i + marks.length) % marks.length
  marks[cur].classList.add('cur')
  marks[cur].scrollIntoView({ block: 'center' })
  $('q-count').textContent = `${cur + 1}/${marks.length}${marks.length >= MAX_MARKS ? '+' : ''}`
}

$('btn-search').addEventListener('click', openSearch)
$('q-close').addEventListener('click', () => closeSearch())
$('q-prev').addEventListener('click', () => { if (marks.length) goToMark(cur - 1) })
$('q-next').addEventListener('click', () => { if (marks.length) goToMark(cur + 1) })
$('q').addEventListener('input', () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { query = $('q').value; runSearch() }, 250)
})
$('q').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return
  e.preventDefault()
  if (marks.length) goToMark(cur - (tab === 'diary' ? 1 : -1))
})

// ── MENU E ANOS ───────────────────────────────────────────────────────────────
function openSheet(title, body) {
  $('sheet-title').textContent = title
  $('sheet-body').innerHTML = body
  if ($('sheet-wrap').hidden) { $('sheet-wrap').hidden = false; pushOverlay('sheet') }
}

function closeSheet(fromBack) {
  if ($('sheet-wrap').hidden) return
  $('sheet-wrap').hidden = true
  $('sheet-body').innerHTML = ''
  if (!fromBack) popOverlay('sheet')
}

function openMenu() {
  const d = data || {}
  const last = d.diary && C.lastEntryDate(d.diary.text)
  const when = d.importedAt ? new Date(d.importedAt) : null
  const counts = [
    d.diary && `${C.countEntries(d.diary.text)} entradas`,
    d.dreams && `${C.dreamList(d.dreams.data).length} sonhos`,
    d.gratitude && `${C.gratitudeList(d.gratitude.data).length} dias de gratidão`,
  ].filter(Boolean).join(' · ')
  const look = currentLook()
  openSheet('Menu', `
    <div class="info">
      ${last ? `Última entrada do diário: <b>${C.fmtDate(last)}</b><br>` : ''}
      ${when ? `Cópia tirada do Drive: <b>${C.fmtDate(when)}</b> às <b>${hhmm(when)}</b><br>` : ''}
      ${esc(counts)}
    </div>
    <button class="sheet-btn" type="button" data-act="import">Actualizar a cópia do Drive</button>
    <div class="sheet-row"><span>Aspecto</span><div class="seg">${LOOKS.map(l =>
      `<button type="button" data-set-look="${l.id}" class="${l.id === look ? 'on' : ''}">${l.label}</button>`).join('')}</div></div>
    <div class="sheet-row"><span>Tamanho da letra</span><div class="seg"><button type="button" data-act="smaller">A−</button><button type="button" data-act="bigger">A+</button></div></div>
    <div id="remind-box"></div>
    <button class="sheet-btn" type="button" data-act="lock">Trancar agora</button>
    <button class="sheet-btn danger" type="button" data-act="wipe">Apagar a cópia deste telemóvel</button>
    <p class="foot">Ler nunca muda nada. O que escreves só sai quando carregas em Enviar, e só entra no diário quando o juntares no Mac. Tranca sozinho depois de um minuto fora da app.</p>`)
  renderRemind()
}

function openYears() {
  const ys = Object.keys(years).sort()
  openSheet('Saltar para', `
    <div class="years">${ys.map(y => `<button type="button" data-year="${y}">${y}</button>`).join('')}</div>
    <div class="seg"><button type="button" data-act="top">Início</button><button type="button" data-act="end">Mais recente</button></div>`)
}

function scrollDiary(where) {
  const v = $('view-diary')
  v.scrollTop = where === 'top' ? 0 : v.scrollHeight
}

$('btn-menu').addEventListener('click', openMenu)
$('btn-years').addEventListener('click', openYears)
$('btn-end').addEventListener('click', () => scrollDiary('end'))
$('sheet-backdrop').addEventListener('click', () => closeSheet())

$('sheet-body').addEventListener('click', e => {
  const b = e.target.closest('button')
  if (!b) return
  if (b.dataset.setLook) {
    applyLook(b.dataset.setLook)
    pref('oirad-leitor-look', b.dataset.setLook)
    $('sheet-body').querySelectorAll('[data-set-look]').forEach(x => x.classList.toggle('on', x === b))
    return
  }
  if (b.dataset.year) {
    closeSheet()
    const el = $('view-diary').querySelector('#' + CSS.escape(years[b.dataset.year]))
    if (el) el.scrollIntoView({ block: 'start' })
    return
  }
  switch (b.dataset.act) {
    case 'import': closeSheet(); openImport(true); break
    case 'smaller': setScale(-1); break
    case 'bigger': setScale(1); break
    case 'lock': closeSheet(); lock(); break
    case 'remind-on': remindOn(); break
    case 'remind-code': remindCode(); break
    case 'top': case 'end': closeSheet(); scrollDiary(b.dataset.act); break
    case 'wipe':
      {
        const unsent = unsentCount(outbox)
        const warn = unsent ? `\n\nATENÇÃO: ${unsent === 1 ? 'há 1 texto escrito' : `há ${unsent} textos escritos`} aqui que não foi enviado nem copiado. Perde-se.` : ''
        if (confirm(`Apagar a cópia guardada neste telemóvel?${warn}\n\nO diário no Mac e no Drive não é tocado.`)) { closeSheet(); wipe() }
      }
      break
  }
})

// ── ASPECTO E TAMANHO ─────────────────────────────────────────────────────────
function currentLook() {
  const l = document.documentElement.dataset.look
  return LOOKS.some(x => x.id === l) ? l : 'original'
}

function applyLook(id) {
  const l = LOOKS.find(x => x.id === id) || LOOKS[0]
  document.documentElement.dataset.look = l.id
  document.querySelector('meta[name="theme-color"]').setAttribute('content', l.bar)
}

function setScale(dir) {
  const now = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1
  let i = SCALES.findIndex(s => Math.abs(s - now) < 0.001)
  if (i === -1) i = SCALES.indexOf(1)
  i = Math.max(0, Math.min(SCALES.length - 1, i + dir))
  document.documentElement.style.setProperty('--scale', SCALES[i])
  pref('oirad-leitor-scale', String(SCALES[i]))
}

// ── ESCREVER ──────────────────────────────────────────────────────────────────
// Entrada, sonho ou gratidão. Cada texto fica numa lista neste telemóvel,
// cifrada, até o António o apagar; Enviar só o entrega ao menu de partilha do
// Android (para o Drive, pasta OIRAD Inbox). Nunca se perde um texto em silêncio:
// o rascunho grava-se enquanto se escreve e ao sair da app.
const KIND_LABEL = { entrada: 'Entrada', sonho: 'Sonho', grato: 'Grato' }
const W = { date: $('w-date'), time: $('w-time'), loc: $('w-loc'), body: $('w-body'), g: [$('w-g1'), $('w-g2'), $('w-g3')] }
let writeKind = 'entrada'
let draftTimer = 0

function emptyOutbox() { return { items: [], draft: null } }
function draftHasText(d) {
  return !!d && !!(String(d.body || '').trim() || String(d.loc || '').trim() || (d.grato || []).some(x => String(x || '').trim()))
}
function unsentCount(ob) {
  return ob.items.filter(i => !i.sentAt && !i.copiedAt).length + (draftHasText(ob.draft) ? 1 : 0)
}

async function openOutbox(k) {
  outboxLocked = false
  let rec = null
  try { rec = await kvGet('outbox') } catch {}
  if (!rec) { outbox = emptyOutbox(); return }
  try { outbox = await C.unseal(k, rec.iv, rec.ct) }
  catch {
    // Não abriu: fica como está no telemóvel e nada se grava por cima.
    outbox = emptyOutbox()
    outboxLocked = true
  }
}

async function saveOutbox(k = key, ob = outbox) {
  if (!k || !ob || outboxLocked) return
  const { iv, ct } = await C.seal(k, ob)
  await kvSet('outbox', { iv, ct })
  await kvSet('outboxMeta', { unsent: unsentCount(ob) })
}

function readForm() {
  return { kind: writeKind, date: W.date.value, time: W.time.value, loc: W.loc.value, body: W.body.value, grato: W.g.map(i => i.value) }
}
function fillForm(d) {
  const now = new Date()
  d = d || {}
  W.date.value = d.date || C.todayIso(now)
  W.time.value = d.time || C.nowHHMM(now)
  W.loc.value = d.loc || ''
  W.body.value = d.body || ''
  W.g.forEach((inp, i) => { inp.value = (d.grato && d.grato[i]) || '' })
  setKind(C.KINDS.includes(d.kind) ? d.kind : 'entrada')
}
function clearWriteForm() {
  W.loc.value = ''
  W.body.value = ''
  W.g.forEach(i => { i.value = '' })
  $('outbox').innerHTML = ''
}
function setKind(kind) {
  writeKind = kind
  $('scr-write').dataset.kind = kind
  document.querySelectorAll('#write-kind button').forEach(b => b.classList.toggle('on', b.dataset.kind === kind))
  document.querySelectorAll('#scr-write [data-for]').forEach(el => { el.hidden = !el.dataset.for.split(' ').includes(kind) })
  say('write-msg')
}
function stashDraft() {
  clearTimeout(draftTimer)
  outbox.draft = readForm()
  saveOutbox().catch(() => {})
}
function updatePendingDot() { $('btn-write').classList.toggle('pending', unsentCount(outbox) > 0) }

function openWrite(kind) {
  if (outboxLocked) return toast('Não consegui abrir o que escreveste neste telemóvel. Não mexi em nada; para não estragar, escrever fica desligado até isto se resolver.')
  // Rascunho com texto volta tal e qual; sem texto, data e hora de agora.
  fillForm(draftHasText(outbox.draft) ? outbox.draft : { kind: outbox.draft && outbox.draft.kind })
  if (C.KINDS.includes(kind)) setKind(kind) // vindo de um lembrete; os campos dos outros ficam guardados
  renderOutbox()
  show('write')
  pushOverlay('write')
}
function closeWrite(fromBack) {
  if ($('scr-write').hidden) return
  stashDraft()
  show('app')
  updatePendingDot()
  if (!fromBack) popOverlay('write')
}

// Passa o rascunho para a lista (já a salvo) e limpa o formulário.
async function commitDraft() {
  const it = readForm()
  const problem = C.captureProblem(it)
  if (problem) { say('write-msg', problem); return null }
  const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: it.kind, date: it.date, time: it.time, createdAt: Date.now(), sentAt: null, copiedAt: null }
  if (it.kind === 'entrada') { item.loc = it.loc.trim(); item.body = it.body.trim() }
  else if (it.kind === 'sonho') item.body = it.body.trim()
  else item.grato = it.grato.map(g => g.trim())
  outbox.items.unshift(item)
  // Limpa só os campos do que foi guardado. Texto escrito noutro tipo fica.
  const rest = { ...it, date: '', time: '' }
  if (it.kind === 'entrada') { rest.loc = ''; rest.body = '' }
  else if (it.kind === 'sonho') rest.body = ''
  else rest.grato = ['', '', '']
  outbox.draft = draftHasText(rest) ? rest : { kind: it.kind }
  clearTimeout(draftTimer)
  try { await saveOutbox() } catch { toast('Atenção: não consegui guardar neste telemóvel. Envia ou copia antes de sair.') }
  fillForm(outbox.draft)
  renderOutbox()
  updatePendingDot()
  return item
}

async function sendItem(item) {
  const file = new File([C.captureText(item)], C.captureFileName(item), { type: 'text/plain' })
  if (!(navigator.canShare && navigator.canShare({ files: [file] }))) {
    toast('Este browser não consegue enviar ficheiros. Usa Copiar e cola numa nota.')
    return
  }
  shareGraceUntil = Date.now() + 5 * 60 * 1000
  sharing = true
  try {
    await navigator.share({ files: [file] })
    item.sentAt = Date.now()
    await saveOutbox()
    toast('Enviado. Confirma no Drive que ficou na pasta OIRAD Inbox.')
  } catch {
    toast('Não foi enviado. Continua guardado aqui, na lista.')
  } finally { sharing = false }
  renderOutbox()
  updatePendingDot()
}

// Copiar: a via moderna, e a antiga se o browser recusar a moderna.
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return } catch {}
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  ta.remove()
  if (!ok) throw new Error('copy')
}

async function copyItem(item) {
  try {
    await copyText(C.captureText(item))
    item.copiedAt = Date.now()
    await saveOutbox()
    toast('Copiado. Cola onde quiseres.')
  } catch { toast('Não consegui copiar.') }
  renderOutbox()
  updatePendingDot()
}

function stamp(ts) { const d = new Date(ts); return `${C.fmtDate(d).slice(0, 5)} ${hhmm(d)}` }

function renderOutbox() {
  const el = $('outbox')
  if (!outbox.items.length) { el.innerHTML = '<p class="ob-empty">Ainda nada.</p>'; return }
  el.innerHTML = outbox.items.map(it => {
    const state = it.sentAt ? `enviado ${stamp(it.sentAt)}` : it.copiedAt ? `copiado ${stamp(it.copiedAt)}` : '<span class="todo">por enviar</span>'
    const preview = it.kind === 'grato' ? (it.grato || []).join(' · ') : (it.body || '')
    return `<div class="ob-item" data-id="${esc(it.id)}">` +
      `<div class="ob-meta">${KIND_LABEL[it.kind] || ''} · ${esc(C.isoToHeader(it.date))} ${esc(it.time)} · ${state}</div>` +
      `<div class="ob-text">${esc(preview)}</div>` +
      `<div class="ob-actions"><button type="button" data-ob="send">Enviar</button><button type="button" data-ob="copy">Copiar</button><button type="button" data-ob="del">Apagar</button></div></div>`
  }).join('')
}

$('btn-write').addEventListener('click', () => openWrite())
$('write-back').addEventListener('click', () => closeWrite())
$('write-kind').addEventListener('click', e => {
  const b = e.target.closest('[data-kind]')
  if (!b) return
  setKind(b.dataset.kind)
  stashDraft()
})
for (const el of [W.date, W.time, W.loc, W.body, ...W.g]) {
  el.addEventListener('input', () => {
    say('write-msg')
    clearTimeout(draftTimer)
    draftTimer = setTimeout(stashDraft, 800)
  })
}
$('w-send').addEventListener('click', async () => { const item = await commitDraft(); if (item) await sendItem(item) })
$('w-copy').addEventListener('click', async () => { const item = await commitDraft(); if (item) await copyItem(item) })
$('outbox').addEventListener('click', async e => {
  const b = e.target.closest('[data-ob]')
  if (!b) return
  const item = outbox.items.find(i => i.id === b.closest('.ob-item').dataset.id)
  if (!item) return
  if (b.dataset.ob === 'send') return sendItem(item)
  if (b.dataset.ob === 'copy') return copyItem(item)
  const msg = item.sentAt || item.copiedAt
    ? 'Apagar este texto deste telemóvel?'
    : 'Este texto ainda não foi enviado nem copiado. Apagar mesmo? Perde-se.'
  if (!confirm(msg)) return
  outbox.items = outbox.items.filter(i => i !== item)
  try { await saveOutbox() } catch {}
  renderOutbox()
  updatePendingDot()
})

// ── LEMBRETES ─────────────────────────────────────────────────────────────────
// As notificações vêm de fora, a horas marcadas: um agendador privado no GitHub
// (antoniograzzawut/oirad-reminders) envia-as pelo serviço de notificações do
// Chrome. Esta página só pede licença ao Android, cria o endereço deste
// telemóvel e deixa copiá-lo para o Claude o pôr no agendador. As notificações
// trazem só o tipo de lembrete; nada do diário passa por elas.
const VAPID_PUBLIC = 'BEbE_yMWEkEW8uP0VsOUi3Z6RqwvnUh5YOdBa-G_T4vTE0Htxldk9Jgcj1H0N2W5Lii-a_6Gq6BDW1H2LKxV4Cc'

function b64urlBytes(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4))
  return Uint8Array.from(b, c => c.charCodeAt(0))
}

async function pushSub() {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

async function renderRemind() {
  const box = $('remind-box')
  if (!box) return
  const row = (state, btn) => {
    box.innerHTML = `<div class="sheet-row"><span>Lembretes</span><span>${state}</span></div>${btn || ''}`
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return row('este browser não recebe')
  if (Notification.permission === 'denied') return row('bloqueados', '<p class="foot">O Android está a bloquear as notificações desta app. Liga-as em Definições → Apps → OIRAD → Notificações e volta aqui.</p>')
  let sub = null
  try { sub = await pushSub() } catch {}
  if (!sub) return row('desligados', '<button class="sheet-btn" type="button" data-act="remind-on">Ligar lembretes</button>')
  row('ligados', '<button class="sheet-btn" type="button" data-act="remind-code">Copiar código para o Claude</button>')
}

async function remindOn() {
  try {
    if (await Notification.requestPermission() !== 'granted') { toast('Sem licença para notificações, não há lembretes.'); return renderRemind() }
    const reg = await navigator.serviceWorker.ready
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlBytes(VAPID_PUBLIC) })
    toast('Ligados. Agora toca em Copiar código e cola-o na conversa com o Claude.')
  } catch { toast('Não consegui ligar os lembretes neste telemóvel.') }
  renderRemind()
}

async function remindCode() {
  try {
    const sub = await pushSub()
    if (!sub) return renderRemind()
    await copyText(JSON.stringify(sub.toJSON()))
    toast('Código copiado. Cola-o na conversa com o Claude.')
  } catch { toast('Não consegui copiar.') }
}

// Um lembrete tocado com a app já aberta chega aqui; com ela fechada, chega
// pelo endereço (?escrever=…) e o arranque trata dele.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    const k = e.data && e.data.escrever
    if (!C.KINDS.includes(k)) return
    if (!key || $('scr-lock').hidden === false) { pendingWrite = k; return }
    if (!$('scr-write').hidden) { setKind(k); stashDraft(); return }
    if ($('scr-app').hidden) return
    if (!overlays.length) return openWrite(k)
    // Menu ou pesquisa abertos: fecham, e a escrita abre quando o histórico assentar.
    closeSheet(true)
    closeSearch(true)
    window.addEventListener('popstate', () => openWrite(k), { once: true })
    dropOverlays()
  })
}

// ── INSTALAR ──────────────────────────────────────────────────────────────────
// O menu novo do Chrome no Android nem sempre mostra "Instalar". Quando o Chrome
// avisa que a página é instalável, a própria página oferece o botão.
let installEvent = null
function showInstall(on) { document.querySelectorAll('.install-btn').forEach(b => { b.hidden = !on }) }
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  installEvent = e
  showInstall(true)
})
window.addEventListener('appinstalled', () => { installEvent = null; showInstall(false) })
document.addEventListener('click', async e => {
  if (!e.target.closest('.install-btn') || !installEvent) return
  const ev = installEvent
  installEvent = null
  showInstall(false)
  try { await ev.prompt(); await ev.userChoice } catch {}
})

// ── BOTÃO "VOLTAR" DO ANDROID ─────────────────────────────────────────────────
// Fecha o que estiver aberto (menu, anos, pesquisa) em vez de sair da app.
const overlays = []
let ignorePops = 0
function pushOverlay(name) { overlays.push(name); history.pushState({ overlay: name }, '') }
function popOverlay(name) {
  const i = overlays.lastIndexOf(name)
  if (i === -1) return
  overlays.splice(i, 1)
  ignorePops++
  history.back()
}
function dropOverlays() {
  const n = overlays.length
  if (!n) return
  overlays.length = 0
  ignorePops++
  history.go(-n)
}
window.addEventListener('popstate', () => {
  if (ignorePops) { ignorePops--; return }
  const name = overlays.pop()
  if (name === 'sheet') closeSheet(true)
  else if (name === 'search') closeSearch(true)
  else if (name === 'write') closeWrite(true)
})

boot()
})()
