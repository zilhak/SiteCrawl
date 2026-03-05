/**
 * Electron + better-sqlite3 영속성 테스트
 *
 * 실행: npx electron tools/electron-db-test.js
 *
 * 앱의 pipeline 저장과 동일한 패턴으로 데이터를 저장하고
 * 재연결 후 영속성을 확인합니다.
 */

const { app } = require('electron')
const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')
const fs = require('fs')

// Electron app ready 이벤트 후 실행
app.whenReady().then(() => {
  const TEST_DIR = path.join(os.tmpdir(), 'sitecrawl-electron-test-' + Date.now())
  fs.mkdirSync(TEST_DIR, { recursive: true })
  const DB_PATH = path.join(TEST_DIR, 'test.db')
  const REAL_DB = path.join('F:', 'save2', 'crawlData', 'sitecrawl.db')

  let passed = 0
  let failed = 0

  function check(condition, msg) {
    if (condition) { console.log(`  OK: ${msg}`); passed++ }
    else { console.log(`  FAIL: ${msg}`); failed++ }
  }

  console.log('=== better-sqlite3 in Electron 영속성 테스트 ===')
  console.log('Electron:', process.versions.electron)
  console.log('Node:', process.versions.node)
  console.log('Test DB:', DB_PATH)

  // ==============================
  // Test 1: WAL + Transaction (앱의 pipeline 저장 방식)
  // ==============================
  console.log('\n[Test 1] WAL + Transaction')
  {
    const db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.exec(`CREATE TABLE IF NOT EXISTS pipelines (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`)
    db.exec(`CREATE TABLE IF NOT EXISTS pipeline_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pipeline_id TEXT NOT NULL, name TEXT NOT NULL,
      trigger_name TEXT NOT NULL, category TEXT NOT NULL,
      task_config TEXT NOT NULL DEFAULT '{}',
      task_id TEXT, phase TEXT DEFAULT 'process',
      FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE,
      UNIQUE(pipeline_id, name)
    )`)

    const txn = db.transaction(() => {
      db.prepare('INSERT OR REPLACE INTO pipelines (id, name, description, created_at, updated_at) VALUES (?,?,?,?,?)')
        .run('p1', 'WAL Txn Test', null, Date.now(), Date.now())
      db.prepare('DELETE FROM pipeline_tasks WHERE pipeline_id = ?').run('p1')
      db.prepare('INSERT INTO pipeline_tasks (pipeline_id, name, trigger_name, category, task_config, phase) VALUES (?,?,?,?,?,?)')
        .run('p1', 'nav', '_run_', 'page_navigation', '{}', 'process')
      db.prepare('INSERT INTO pipeline_tasks (pipeline_id, name, trigger_name, category, task_config, phase) VALUES (?,?,?,?,?,?)')
        .run('p1', 'ext', 'nav', 'link_extraction', '{}', 'process')
    })
    txn()

    const cnt = db.prepare('SELECT COUNT(*) as c FROM pipelines').get()
    const tcnt = db.prepare('SELECT COUNT(*) as c FROM pipeline_tasks').get()
    console.log(`  저장 직후: pipelines=${cnt.c}, tasks=${tcnt.c}`)
    check(cnt.c === 1, 'pipeline 저장됨')
    check(tcnt.c === 2, 'tasks 저장됨')

    const walSize = fs.existsSync(DB_PATH + '-wal') ? fs.statSync(DB_PATH + '-wal').size : 0
    console.log(`  WAL 크기: ${walSize} bytes`)
    db.close()
  }
  // 재연결
  {
    const db2 = new Database(DB_PATH)
    db2.pragma('journal_mode = WAL')
    const cnt = db2.prepare('SELECT COUNT(*) as c FROM pipelines').get()
    const tcnt = db2.prepare('SELECT COUNT(*) as c FROM pipeline_tasks').get()
    console.log(`  재연결: pipelines=${cnt.c}, tasks=${tcnt.c}`)
    check(cnt.c === 1, '재연결 후 pipeline 존재')
    check(tcnt.c === 2, '재연결 후 tasks 존재')
    db2.close()
  }

  // ==============================
  // Test 2: WAL + 개별 쿼리 (앱의 task 저장 방식)
  // ==============================
  console.log('\n[Test 2] WAL + 개별 쿼리')
  {
    const db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.exec(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, name TEXT, category TEXT,
      config TEXT DEFAULT '{}', created_at INTEGER, updated_at INTEGER
    )`)
    db.prepare('INSERT OR REPLACE INTO tasks VALUES (?,?,?,?,?,?)')
      .run('t1', 'Test Task', 'crawl', '{}', Date.now(), Date.now())
    db.close()
  }
  {
    const db2 = new Database(DB_PATH)
    const cnt = db2.prepare('SELECT COUNT(*) as c FROM tasks').get()
    check(cnt.c === 1, `재연결 후 task 존재: ${cnt.c}`)
    db2.close()
  }

  // ==============================
  // Test 3: DELETE + Transaction
  // ==============================
  console.log('\n[Test 3] DELETE 모드 + Transaction')
  const DB3 = path.join(TEST_DIR, 'test3.db')
  {
    const db = new Database(DB3)
    db.pragma('journal_mode = DELETE')
    db.pragma('synchronous = FULL')
    db.exec(`CREATE TABLE IF NOT EXISTS pipelines (id TEXT PRIMARY KEY, name TEXT, created_at INTEGER, updated_at INTEGER)`)

    const txn = db.transaction(() => {
      db.prepare('INSERT OR REPLACE INTO pipelines VALUES (?,?,?,?)').run('p1', 'DELETE Test', Date.now(), Date.now())
    })
    txn()
    db.close()
  }
  {
    const db2 = new Database(DB3)
    const cnt = db2.prepare('SELECT COUNT(*) as c FROM pipelines').get()
    check(cnt.c === 1, `DELETE 모드 재연결: ${cnt.c}`)
    db2.close()
  }

  // ==============================
  // Test 4: 실제 앱 DB 상태 확인
  // ==============================
  console.log('\n[Test 4] 실제 앱 DB 확인')
  if (fs.existsSync(REAL_DB)) {
    try {
      const db = new Database(REAL_DB, { readonly: true })
      const pCnt = db.prepare('SELECT COUNT(*) as c FROM pipelines').get()
      const tCnt = db.prepare('SELECT COUNT(*) as c FROM pipeline_tasks').get()
      const taskCnt = db.prepare('SELECT COUNT(*) as c FROM tasks').get()
      const histCnt = db.prepare('SELECT COUNT(*) as c FROM crawl_history').get()

      console.log(`  pipelines: ${pCnt.c}`)
      console.log(`  pipeline_tasks: ${tCnt.c}`)
      console.log(`  tasks: ${taskCnt.c}`)
      console.log(`  crawl_history: ${histCnt.c}`)

      if (pCnt.c > 0) {
        const rows = db.prepare('SELECT id, name FROM pipelines').all()
        rows.forEach(r => console.log(`    -> ${r.name} (${r.id})`))
      } else {
        console.log('  -> 파이프라인 없음!')
        console.log('  -> tasks는 있고 pipelines만 없음 = pipeline save에 문제')
      }
      db.close()
    } catch (err) {
      console.log(`  오류: ${err.message}`)
    }
  } else {
    console.log(`  실제 DB 없음: ${REAL_DB}`)
  }

  // ==============================
  // Test 5: 실제 앱 DB에 테스트 파이프라인 쓰기
  // ==============================
  console.log('\n[Test 5] 실제 앱 DB에 better-sqlite3로 직접 쓰기')
  if (fs.existsSync(REAL_DB)) {
    try {
      const db = new Database(REAL_DB)
      const testId = 'electron_test_' + Date.now()

      const txn = db.transaction(() => {
        db.prepare('INSERT OR REPLACE INTO pipelines (id, name, description, created_at, updated_at) VALUES (?,?,?,?,?)')
          .run(testId, '[Electron테스트] 직접기록', null, Date.now(), Date.now())
        db.prepare('INSERT INTO pipeline_tasks (pipeline_id, name, trigger_name, category, task_config, phase) VALUES (?,?,?,?,?,?)')
          .run(testId, 'test_nav', '_run_', 'page_navigation', '{}', 'process')
      })
      txn()

      // checkpoint
      try { db.pragma('wal_checkpoint(PASSIVE)') } catch (e) { console.log('  checkpoint error:', e.message) }

      const cnt = db.prepare('SELECT COUNT(*) as c FROM pipelines').get()
      console.log(`  기록 후 pipelines: ${cnt.c}`)
      check(cnt.c > 0, '실제 DB에 pipeline 기록 성공')
      db.close()

      // 재연결로 확인
      const db2 = new Database(REAL_DB, { readonly: true })
      const cnt2 = db2.prepare('SELECT COUNT(*) as c FROM pipelines').get()
      console.log(`  재연결 확인: ${cnt2.c}`)
      check(cnt2.c > 0, '실제 DB 재연결 후 pipeline 존재')
      db2.close()
    } catch (err) {
      console.log(`  오류: ${err.message}`)
    }
  }

  // 정리
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true })
  } catch { /* ignore */ }

  console.log(`\n========== 결과: ${passed} passed, ${failed} failed ==========`)
  app.quit()
})

app.on('window-all-closed', () => app.quit())
