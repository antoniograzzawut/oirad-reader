// OIRAD Leitor: a lógica sem ecrã. Corre no browser (window.OiradCore) e no
// Node (testes). Nada aqui escreve em lado nenhum: lê texto, devolve texto.
(function (root) {
'use strict'

// ── DIÁRIO ────────────────────────────────────────────────────────────────────
// Copiado tal e qual de oirad-app/index.html, para o telemóvel mostrar o diário
// exactamente como o Mac. test/core.test.js compara os dois quando encontra a
// app do Mac ao lado; se o Mac mudar as regras, copiar outra vez.
function parseOIRAD(src){
  if(!src.trim()) return {html:'',years:{},locations:{}}

  function e(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
  function inline(s){
    return s
      .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/`(.+?)`/g,'<code>$1</code>')
  }

  const isOldDate = s => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)
  const isTime    = s => /^\d{1,2}:\d{2}$/.test(s)

  const lines   = src.split('\n')
  const out     = []
  const years   = {}
  const locs    = {}
  let i         = 0
  let hCount    = 0
  let lastId    = null
  let afterTime = false

  while(i < lines.length){
    const raw = lines[i]
    const s   = raw.trim()

    // Markdown heading
    const hm = s.match(/^(#{1,6})\s+(.+)$/)
    if(hm){
      const lv=hm[1].length, id=`h${hCount++}`, text=hm[2]
      lastId=id; afterTime=false
      const yr=text.match(/\b(20\d{2}|19\d{2})\b/)?.[1]
      if(yr && !years[yr]) years[yr]=id
      out.push(`<h${lv} id="${id}">${inline(e(text))}</h${lv}>`)
      i++; continue
    }

    // Old-format date
    if(isOldDate(s)){
      const id=`h${hCount++}`
      lastId=id; afterTime=false
      const yr=s.match(/(\d{4})/)?.[1]
      if(yr && !years[yr]) years[yr]=id
      out.push(`<hr class="entry-sep"><div id="${id}"><strong class="entry-date">${e(s)}</strong></div>`)
      i++; continue
    }

    // Time
    if(isTime(s)){
      out.push(`<span class="entry-time">${e(s)}</span>`)
      afterTime=true
      i++; continue
    }

    // Location: short line immediately after time
    if(afterTime && s && s.length<=55 && !/[.?!,;:]$/.test(s) && !/^\[/.test(s)){
      if(lastId && !locs[s]) locs[s]=lastId
      out.push(`<em class="entry-loc">${e(s)}</em>`)
      afterTime=false
      i++; continue
    }

    if(s) afterTime=false

    // HR
    if(/^[-*_]{3,}\s*$/.test(s)){ out.push('<hr>'); i++; continue }

    // Blank
    if(!s){ i++; continue }

    // Annotation block [Notas de Eu] or any [label]
    if(s.startsWith('[') && s.endsWith(']') && s.length < 80){
      const parts=[`<strong>${e(s)}</strong>`]
      i++
      while(i<lines.length && lines[i].trim() && !isOldDate(lines[i].trim()) && !/^#+/.test(lines[i].trim()) && !isTime(lines[i].trim())){
        parts.push(inline(e(lines[i].trim())))
        i++
      }
      out.push(`<div class="annotation">${parts.join('<br>')}</div>`)
      continue
    }

    // Bullet list
    if(/^[\*\-] /.test(s)){
      const items=[]
      while(i<lines.length && /^[\*\-] /.test(lines[i].trim())){
        items.push(`<li>${inline(e(lines[i].trim().slice(2)))}</li>`); i++
      }
      out.push(`<ul>${items.join('')}</ul>`); continue
    }

    // Paragraph
    const para=[]
    while(
      i<lines.length && lines[i].trim() &&
      !/^#{1,6}\s+\S/.test(lines[i].trim()) &&
      !isOldDate(lines[i].trim()) &&
      !isTime(lines[i].trim()) &&
      !/^[-*_]{3,}\s*$/.test(lines[i].trim()) &&
      !/^[\*\-] /.test(lines[i].trim()) &&
      !(lines[i].trim().startsWith('[') && lines[i].trim().endsWith(']') && lines[i].trim().length<80)
    ){ para.push(inline(e(lines[i]))); i++ }
    // Safety net: if nothing was consumed, this line matched no branch and no
    // paragraph guard — force progress so the parser can never infinite-loop.
    if(para.length) out.push(`<p>${para.join('<br>')}</p>`)
    else { out.push(`<p>${inline(e(lines[i]))}</p>`); i++ }
  }

  return { html: out.join('\n'), years, locations: locs }
}

const DATE_LINE = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/

function countEntries(src) {
  let n = 0
  for (const line of src.split('\n')) if (DATE_LINE.test(line.trim())) n++
  return n
}

// A data mais recente do diário, ignorando datas no futuro (gralhas).
function lastEntryDate(src, now) {
  const limit = (now || new Date()).getTime() + 2 * 86400000
  let best = null
  for (const line of src.split('\n')) {
    const m = line.trim().match(DATE_LINE)
    if (!m) continue
    const d = new Date(+m[3], +m[2] - 1, +m[1])
    if (isNaN(d) || d.getTime() > limit) continue
    if (!best || d > best) best = d
  }
  return best
}

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// ── SONHOS E GRATIDÃO ─────────────────────────────────────────────────────────
// Mesmas regras do arquivo do Mac: só sonhos com texto, mais recentes primeiro.
// As chaves mostram-se como estão guardadas (o desvio UTC do dk() incluído),
// para o telemóvel dizer o mesmo dia que o Mac.
function keyLabel(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : key
}

function dreamList(all) {
  if (!all || typeof all !== 'object') return []
  return Object.keys(all).map(key => ({ key, data: all[key] }))
    .filter(({ data }) => data && data.dreamed && typeof data.entry === 'string' && data.entry.trim())
    .sort((a, b) => b.key.localeCompare(a.key))
}

function gratitudeList(all) {
  if (!all || typeof all !== 'object') return []
  return Object.keys(all).map(key => ({ key, data: all[key] }))
    .filter(({ data }) => data && Array.isArray(data.entries) && data.entries.some(e => typeof e === 'string' && e.trim()))
    .sort((a, b) => b.key.localeCompare(a.key))
}

// ── RECONHECER OS FICHEIROS ESCOLHIDOS ────────────────────────────────────────
// Nunca adivinha em silêncio: o que não reconhece volta como 'unknown' com a razão.
function classifyFile(name, text) {
  const lower = String(name || '').toLowerCase()
  if (/\.(docx?|pdf|rtf|pages|odt)$/.test(lower)) return { kind: 'unknown', reason: 'formato que o leitor não abre' }
  if (lower.endsWith('.json') || /^\s*[{[]/.test(text)) {
    let json
    try { json = JSON.parse(text) } catch { return { kind: 'unknown', reason: 'JSON que não consegui ler' } }
    if (!json || typeof json !== 'object' || Array.isArray(json)) return { kind: 'unknown', reason: 'não é sonhos nem gratidão' }
    const vals = Object.values(json).filter(v => v && typeof v === 'object')
    const dreamShape = vals.length > 0 && vals.every(v => 'dreamed' in v)
    const gratShape = vals.length > 0 && vals.every(v => Array.isArray(v.entries))
    if (lower.includes('dream') || dreamShape) return { kind: 'dreams', data: json }
    if (lower.includes('grat') || gratShape) return { kind: 'gratitude', data: json }
    return { kind: 'unknown', reason: 'não é sonhos nem gratidão' }
  }
  const entries = countEntries(text)
  if (entries > 0) return { kind: 'diary', text, entries }
  return { kind: 'unknown', reason: 'texto sem entradas com data' }
}

// ── PESQUISA ──────────────────────────────────────────────────────────────────
// Sem acentos e sem maiúsculas: "coracao" encontra "Coração". Devolve também,
// para cada letra simplificada, a posição no texto original, para marcar o sítio certo.
function foldWithMap(s) {
  let out = ''
  const map = []
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const code = c.charCodeAt(0)
    const f = code < 128 ? c.toLowerCase() : c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    for (let j = 0; j < f.length; j++) { out += f[j]; map.push(i) }
  }
  map.push(s.length)
  return { out, map }
}

function fold(s) { return foldWithMap(s).out }

// Posições [início, fim) de cada ocorrência de `needle` (já simplificada) em `s`.
function findAll(s, needle) {
  if (!needle) return []
  const { out, map } = foldWithMap(s)
  const hits = []
  let i = out.indexOf(needle)
  while (i !== -1) {
    hits.push([map[i], map[i + needle.length - 1] + 1])
    i = out.indexOf(needle, i + needle.length)
  }
  return hits
}

// ── CIFRA ─────────────────────────────────────────────────────────────────────
// A cópia guardada no telemóvel vai cifrada com a palavra-passe (AES-GCM, chave
// tirada da palavra-passe com PBKDF2). Sem a palavra-passe é ruído.
const ITER = 310000
const te = new TextEncoder()
const td = new TextDecoder()
const cryptoApi = () => (typeof globalThis !== 'undefined' && globalThis.crypto) || root.crypto

async function deriveKey(password, salt, iter) {
  const subtle = cryptoApi().subtle
  const base = await subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey'])
  return subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter || ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function seal(key, obj) {
  const iv = cryptoApi().getRandomValues(new Uint8Array(12))
  const ct = await cryptoApi().subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)))
  return { iv, ct: new Uint8Array(ct) }
}

// Palavra-passe errada faz isto rebentar (o AES-GCM verifica a integridade).
async function unseal(key, iv, ct) {
  const pt = await cryptoApi().subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return JSON.parse(td.decode(pt))
}

function newSalt() { return cryptoApi().getRandomValues(new Uint8Array(16)) }

// ── ESCREVER ──────────────────────────────────────────────────────────────────
// O que se escreve no telemóvel sai como ficheiro de texto para a pasta OIRAD
// Inbox do Drive. Nunca entra no diário daqui: entra no Mac, pela mão do António.
const KINDS = ['entrada', 'sonho', 'grato']
const pad = n => String(n).padStart(2, '0')

function isoToHeader(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
function todayIso(d) { d = d || new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function nowHHMM(d) { d = d || new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

// Uma entrada sai igual ao bloco que a "+ Nova Entrada" do Mac junta ao diário,
// para se poder colar tal e qual no modo de texto do diário.
function captureText(it) {
  const date = isoToHeader(it.date)
  if (it.kind === 'entrada') {
    const locLine = it.loc && it.loc.trim() ? `${it.loc.trim()}\n` : ''
    return `${date}\n\n${it.time}\n${locLine}\n${(it.body || '').trim()}\n`
  }
  if (it.kind === 'sonho') return `Sonho · ${date} · ${it.time}\n\n${(it.body || '').trim()}\n`
  const lines = (it.grato || []).map((g, i) => `${i + 1}. ${String(g || '').trim()}`).join('\n')
  return `Grato · ${date} · ${it.time}\n\n${lines}\n`
}

function captureFileName(it) {
  const c = new Date(it.createdAt || Date.now())
  return `oirad-${it.kind}-${it.date}-${pad(c.getHours())}${pad(c.getMinutes())}${pad(c.getSeconds())}.txt`
}

// Devolve o que falta, ou '' se está pronto a enviar. Gratidão pede as três, como no Mac.
function captureProblem(it) {
  if (!KINDS.includes(it.kind)) return 'Escolhe Entrada, Sonho ou Grato.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date || '')) return 'Falta a data.'
  if (!/^\d{1,2}:\d{2}$/.test(it.time || '')) return 'Falta a hora.'
  if (it.kind === 'grato') {
    const g = it.grato || []
    return g.length === 3 && g.every(x => String(x || '').trim()) ? '' : 'Preenche as três.'
  }
  return (it.body || '').trim() ? '' : 'Escreve alguma coisa primeiro.'
}

const api = {
  parseOIRAD, countEntries, lastEntryDate, fmtDate, keyLabel, dreamList, gratitudeList,
  classifyFile, foldWithMap, fold, findAll, ITER, deriveKey, seal, unseal, newSalt,
  KINDS, isoToHeader, todayIso, nowHHMM, captureText, captureFileName, captureProblem,
}
if (typeof module !== 'undefined' && module.exports) module.exports = api
else root.OiradCore = api
})(typeof self !== 'undefined' ? self : this)
