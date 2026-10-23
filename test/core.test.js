// Testes da lógica do leitor, só com dados falsos (test/fixtures). Correr: npm test
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const C = require('../core.js')

const FIX = path.join(__dirname, 'fixtures')
const read = name => fs.readFileSync(path.join(FIX, name), 'utf8')
const DIARY_NAME = "OIRAD 2026 ' Janeiro.txt"
const diary = read(DIARY_NAME)

let failed = 0
async function test(name, fn) {
  try { await fn(); console.log('ok   ' + name) }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message) }
}

;(async () => {
  await test('o diário falso parte-se em entradas como no Mac', () => {
    const r = C.parseOIRAD(diary)
    assert.equal((r.html.match(/class="entry-date"/g) || []).length, 6)
    assert.deepEqual(Object.keys(r.years).sort(), ['2011', '2014', '2022', '2026', '2099'])
    assert.match(r.html, /<div class="annotation"><strong>\[Notas de Eu\]<\/strong>/)
    assert.match(r.html, /<em class="entry-loc">Comboio para o Porto<\/em>/)
  })

  await test('uma data citada com ↳ não abre entrada nova', () => {
    const r = C.parseOIRAD(diary)
    assert.ok(!r.html.includes('entry-date">18/10/2018'))
    assert.ok(r.html.includes('↳ 18/10/2018'))
  })

  await test('HTML dentro do diário aparece como texto', () => {
    const r = C.parseOIRAD(diary)
    assert.ok(!r.html.includes('<script>'))
    assert.ok(r.html.includes('&lt;script&gt;'))
  })

  await test('última entrada ignora datas no futuro', () => {
    const d = C.lastEntryDate(diary, new Date(2026, 9, 23))
    assert.equal(C.fmtDate(d), '22/10/2026')
  })

  await test('reconhece os três ficheiros pelo nome', () => {
    assert.equal(C.classifyFile(DIARY_NAME, diary).kind, 'diary')
    assert.equal(C.classifyFile('oirad-dreams.json', read('oirad-dreams.json')).kind, 'dreams')
    assert.equal(C.classifyFile('oirad-gratitude.json', read('oirad-gratitude.json')).kind, 'gratitude')
  })

  await test('reconhece sonhos e gratidão pela forma, com outro nome', () => {
    assert.equal(C.classifyFile('copia (1).json', read('oirad-dreams.json')).kind, 'dreams')
    assert.equal(C.classifyFile('sem nome', JSON.stringify({ '2026-01-01': { entries: ['a'], time: '1' } })).kind, 'gratitude')
  })

  await test('recusa o que não é dela e diz porquê', () => {
    const tasks = C.classifyFile('oirad-tasks.json', read('oirad-tasks.json'))
    assert.equal(tasks.kind, 'unknown')
    assert.ok(tasks.reason)
    assert.equal(C.classifyFile('x.json', '{ estragado').kind, 'unknown')
    assert.equal(C.classifyFile('OIRAD 2019.docx', 'PK...').kind, 'unknown')
    assert.equal(C.classifyFile('notas.txt', 'texto sem datas').kind, 'unknown')
  })

  await test('sonhos: só os que têm texto, mais recentes primeiro', () => {
    const l = C.dreamList(JSON.parse(read('oirad-dreams.json')))
    assert.deepEqual(l.map(x => x.key), ['2026-10-22', '2026-10-19'])
    assert.equal(C.keyLabel(l[0].key), '22/10/2026')
  })

  await test('gratidão: ignora registos estragados', () => {
    const l = C.gratitudeList(JSON.parse(read('oirad-gratitude.json')))
    assert.deepEqual(l.map(x => x.key), ['2026-10-22', '2026-10-20'])
  })

  await test('pesquisa sem acentos encontra o sítio certo', () => {
    const s = 'Um Coração e outro coracao.'
    const hits = C.findAll(s, C.fold('CORAÇÃO'))
    assert.deepEqual(hits.map(([a, b]) => s.slice(a, b)), ['Coração', 'coracao'])
  })

  await test('pesquisa com emoji não desalinha as marcas', () => {
    const s = '😀 maçã 😀 maca'
    const hits = C.findAll(s, C.fold('maca'))
    assert.deepEqual(hits.map(([a, b]) => s.slice(a, b)), ['maçã', 'maca'])
  })

  await test('cifra: a palavra certa abre, a errada não', async () => {
    const salt = C.newSalt()
    const k = await C.deriveKey('palavra certa', salt, 1000)
    const box = await C.seal(k, { diary: { name: DIARY_NAME, text: diary } })
    assert.ok(!Buffer.from(box.ct).toString('utf8').includes('Coração'))
    const back = await C.unseal(await C.deriveKey('palavra certa', salt, 1000), box.iv, box.ct)
    assert.equal(back.diary.text, diary)
    await assert.rejects(async () => C.unseal(await C.deriveKey('palavra errada', salt, 1000), box.iv, box.ct))
  })

  // A cópia do parser tem de ser igual à do Mac. Só corre quando encontra a app do Mac.
  const macCandidates = [
    path.join(__dirname, '..', '..', 'oirad-app', 'index.html'),
    path.join(os.homedir(), 'Cursor Projects', 'Master Workspace', 'experiments', 'oirad-app', 'index.html'),
  ]
  const mac = macCandidates.find(p => fs.existsSync(p))
  if (mac) {
    await test('o parser é igual ao da app do Mac', () => {
      const src = fs.readFileSync(mac, 'utf8')
      const m = src.match(/^function parseOIRAD\(src\)\{[\s\S]*?^}$/m)
      assert.ok(m, 'não encontrei parseOIRAD na app do Mac')
      const own = fs.readFileSync(path.join(__dirname, '..', 'core.js'), 'utf8').match(/^function parseOIRAD\(src\)\{[\s\S]*?^}$/m)
      assert.equal(own[0], m[0], 'o parser do Mac mudou: copiar outra vez para core.js')
    })
  } else {
    console.log('skip o parser é igual ao da app do Mac (app do Mac não encontrada)')
  }

  console.log(failed ? `\n${failed} falharam` : '\ntudo passou')
  process.exit(failed ? 1 : 0)
})()
