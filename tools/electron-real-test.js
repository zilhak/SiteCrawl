/**
 * 앱의 실제 PipelineDatabase/PipelineManager 코드를 사용한 영속성 테스트
 *
 * 실행: npx electron tools/electron-real-test.js
 *
 * dist-electron/에 컴파일된 실제 앱 코드를 import하여
 * 앱과 100% 동일한 코드 경로로 파이프라인을 저장/로드합니다.
 */

const { app } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

app.whenReady().then(() => {
  const Database = require('better-sqlite3')

  // 실제 앱의 컴파일된 코드 import
  const pipelineModule = require(path.join(__dirname, '..', 'dist-electron', 'pipeline'))
  const { PipelineDatabase, PipelineManager } = pipelineModule

  const REAL_DB_PATH = path.join('F:', 'save2', 'crawlData', 'sitecrawl.db')
  const TEST_DIR = path.join(os.tmpdir(), 'sitecrawl-real-test-' + Date.now())
  fs.mkdirSync(TEST_DIR, { recursive: true })
  const TEST_DB_PATH = path.join(TEST_DIR, 'test.db')

  let passed = 0
  let failed = 0
  function check(cond, msg) {
    if (cond) { console.log(`  OK: ${msg}`); passed++ }
    else { console.log(`  FAIL: ${msg}`); failed++ }
  }

  console.log('=== 실제 앱 코드 영속성 테스트 ===')
  console.log('Electron:', process.versions.electron)
  console.log('Node:', process.versions.node)

  // ==============================
  // Test 1: 테스트 DB에서 PipelineDatabase + PipelineManager 사용
  // ==============================
  console.log('\n[Test 1] 앱과 동일한 코드로 테스트 DB에 저장')
  {
    const db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')

    const pipelineDB = new PipelineDatabase(db)
    const manager = new PipelineManager(pipelineDB)

    const pipeline = {
      id: 'real_test_' + Date.now(),
      name: 'Real Code Test Pipeline',
      description: '앱 코드 영속성 테스트',
      tasks: [
        { name: 'nav', trigger: '_run_', category: 'page_navigation', taskConfig: { waitUntil: 'domcontentloaded' } },
        { name: 'extract', trigger: 'nav', category: 'link_extraction', taskConfig: { includeHrefLinks: true } },
        { name: 'filter', trigger: 'extract', category: 'string_filter', taskConfig: { limit: 10 } }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const result = manager.savePipeline(pipeline)
    console.log('  savePipeline 결과:', JSON.stringify(result))
    check(result.success, `savePipeline 성공: ${result.success}`)

    // 같은 연결에서 확인
    const loaded = manager.getPipeline(pipeline.id)
    check(loaded !== null, `같은 연결에서 로드: ${loaded ? 'OK' : 'FAIL'}`)
    check(loaded?.tasks?.length === 3, `tasks 수: ${loaded?.tasks?.length}`)

    const all = manager.getAllPipelines()
    check(all.length >= 1, `getAllPipelines: ${all.length}`)

    db.close()
    console.log('  DB 닫음')
  }

  // 재연결
  console.log('\n[Test 2] DB 재연결 후 확인 (앱 재시작 시뮬레이션)')
  {
    const db2 = new Database(TEST_DB_PATH)
    db2.pragma('journal_mode = WAL')

    const pipelineDB2 = new PipelineDatabase(db2)
    const manager2 = new PipelineManager(pipelineDB2)

    const all = manager2.getAllPipelines()
    console.log('  재연결 후 pipelines:', all.length)
    check(all.length >= 1, `재연결 후 pipeline 존재: ${all.length}`)

    if (all.length > 0) {
      check(all[0].name === 'Real Code Test Pipeline', `이름: ${all[0].name}`)
      check(all[0].tasks.length === 3, `tasks: ${all[0].tasks.length}`)
    }

    db2.close()
  }

  // ==============================
  // Test 3: 실제 앱 DB에 직접 저장
  // ==============================
  console.log('\n[Test 3] 실제 앱 DB에 앱 코드로 저장')
  if (fs.existsSync(REAL_DB_PATH)) {
    const db3 = new Database(REAL_DB_PATH)
    db3.pragma('journal_mode = WAL')

    const pipelineDB3 = new PipelineDatabase(db3)
    const manager3 = new PipelineManager(pipelineDB3)

    const beforeCount = manager3.getAllPipelines().length
    console.log('  저장 전 pipelines:', beforeCount)

    const pipeline = {
      id: 'real_app_test_' + Date.now(),
      name: '[테스트] Electron 직접 저장',
      description: '앱 코드로 실제 DB에 저장',
      tasks: [
        { name: 'nav', trigger: '_run_', category: 'page_navigation', taskConfig: {} },
        { name: 'ext', trigger: 'nav', category: 'link_extraction', taskConfig: { includeHrefLinks: true } }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const result = manager3.savePipeline(pipeline)
    console.log('  savePipeline 결과:', JSON.stringify(result))
    check(result.success, `실제 DB 저장: ${result.success}`)

    const afterCount = manager3.getAllPipelines().length
    console.log('  저장 후 pipelines:', afterCount)
    check(afterCount === beforeCount + 1, `카운트 증가: ${beforeCount} -> ${afterCount}`)

    db3.close()
    console.log('  DB 닫음')

    // 재연결 확인
    const db4 = new Database(REAL_DB_PATH, { readonly: true })
    const pipelineDB4 = new PipelineDatabase(db4)
    const reloadCount = pipelineDB4.getAllPipelines().length
    console.log('  재연결 후 pipelines:', reloadCount)
    check(reloadCount === afterCount, `재연결 후 일치: ${reloadCount}`)

    const found = pipelineDB4.getAllPipelines().find(p => p.name === '[테스트] Electron 직접 저장')
    check(!!found, `테스트 pipeline 발견: ${found ? 'YES' : 'NO'}`)
    if (found) {
      check(found.tasks.length === 2, `tasks: ${found.tasks.length}`)
    }

    db4.close()
  } else {
    console.log('  실제 DB 없음, 스킵')
  }

  // ==============================
  // Test 4: 앱과 동일한 이중 연결 패턴 (HistoryDB → PipelineDB)
  // ==============================
  console.log('\n[Test 4] HistoryDB → PipelineDB 이중 참조 패턴')
  {
    // HistoryDatabase 시뮬레이션
    const DB5 = path.join(TEST_DIR, 'test5.db')
    const historyDb = new Database(DB5)
    historyDb.pragma('journal_mode = WAL')
    historyDb.exec('CREATE TABLE IF NOT EXISTS crawl_history (id INTEGER PRIMARY KEY, url TEXT)')

    // PipelineDatabase에 같은 인스턴스 전달 (앱과 동일)
    const pipelineDB5 = new PipelineDatabase(historyDb)
    const manager5 = new PipelineManager(pipelineDB5)

    const pipeline = {
      id: 'shared_conn_test',
      name: 'Shared Connection Test',
      tasks: [
        { name: 'nav', trigger: '_run_', category: 'page_navigation', taskConfig: {} }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    manager5.savePipeline(pipeline)

    // historyDb를 닫으면 PipelineDatabase의 참조도 닫힘
    historyDb.close()

    // 재연결
    const historyDb2 = new Database(DB5)
    historyDb2.pragma('journal_mode = WAL')
    const pipelineDB5b = new PipelineDatabase(historyDb2)
    const manager5b = new PipelineManager(pipelineDB5b)

    const all = manager5b.getAllPipelines()
    check(all.length === 1, `이중 참조 후 pipeline: ${all.length}`)
    historyDb2.close()
  }

  // 정리
  try { fs.rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}

  console.log(`\n========== 결과: ${passed} passed, ${failed} failed ==========`)
  app.quit()
})

app.on('window-all-closed', () => app.quit())
