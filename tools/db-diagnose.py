#!/usr/bin/env python3
"""
Pipeline DB 영속성 진단 도구

앱의 PipelineDatabase.savePipeline() 동작을 시뮬레이션하여
WAL/DELETE 저널 모드에서의 영속성을 검증합니다.

사용법:
  python tools/db-diagnose.py                 # 전체 진단 실행
  python tools/db-diagnose.py --app-db        # 실제 앱 DB도 진단
"""

import sqlite3
import os
import sys
import time
import tempfile
import json

passed = 0
failed = 0

def check(condition, msg):
    global passed, failed
    if condition:
        print(f"  OK: {msg}")
        passed += 1
    else:
        print(f"  FAIL: {msg}")
        failed += 1

def create_test_db(path, journal_mode='wal', synchronous=None):
    """테스트 DB 생성 (앱의 HistoryDatabase + PipelineDatabase 초기화 시뮬레이션)"""
    conn = sqlite3.connect(path)
    conn.execute(f"PRAGMA journal_mode = {journal_mode}")
    if synchronous:
        conn.execute(f"PRAGMA synchronous = {synchronous}")

    # HistoryDatabase.initialize()
    conn.execute("""CREATE TABLE IF NOT EXISTS crawl_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT,
        description TEXT,
        linkCount INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL
    )""")

    # PipelineDatabase.initialize()
    conn.execute("""CREATE TABLE IF NOT EXISTS pipelines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS pipeline_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pipeline_id TEXT NOT NULL,
        name TEXT NOT NULL,
        trigger_name TEXT NOT NULL,
        category TEXT NOT NULL,
        task_config TEXT NOT NULL DEFAULT '{}',
        task_id TEXT,
        phase TEXT DEFAULT 'process',
        FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE,
        UNIQUE(pipeline_id, name)
    )""")

    # TaskDatabase 테이블
    conn.execute("""CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )""")

    conn.commit()
    return conn

def save_pipeline_like_app(conn, pipeline_id, name, tasks):
    """앱의 PipelineDatabase.savePipeline() 동작 시뮬레이션
    better-sqlite3의 transaction() 패턴을 Python으로 재현"""
    now = int(time.time() * 1000)
    cur = conn.cursor()

    try:
        cur.execute("BEGIN IMMEDIATE")

        # Pipeline 기본 정보 저장
        cur.execute(
            "INSERT OR REPLACE INTO pipelines (id, name, description, created_at, updated_at) VALUES (?,?,?,?,?)",
            (pipeline_id, name, None, now, now)
        )

        # 기존 Task 삭제
        cur.execute("DELETE FROM pipeline_tasks WHERE pipeline_id = ?", (pipeline_id,))

        # Task 저장
        for task in tasks:
            cur.execute(
                "INSERT INTO pipeline_tasks (pipeline_id, name, trigger_name, category, task_config, phase) VALUES (?,?,?,?,?,?)",
                (pipeline_id, task['name'], task['trigger'], task['category'], json.dumps(task.get('config', {})), task.get('phase', 'process'))
            )

        cur.execute("COMMIT")
    except Exception as e:
        cur.execute("ROLLBACK")
        raise e

def save_task_like_app(conn, task_id, name, category):
    """앱의 TaskDatabase.saveTask() 동작 시뮬레이션
    개별 쿼리, transaction 없음 (auto-commit)"""
    now = int(time.time() * 1000)
    conn.execute(
        "INSERT OR REPLACE INTO tasks (id, name, category, config, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        (task_id, name, category, '{}', now, now)
    )
    conn.commit()

def test_wal_mode_transaction():
    """테스트: WAL 모드에서 Transaction으로 저장 후 재연결"""
    print("\n[Test 1] WAL 모드 + Transaction (앱의 pipeline 저장 방식)")
    db_path = os.path.join(tempfile.mkdtemp(), 'test1.db')

    conn = create_test_db(db_path, 'wal')
    save_pipeline_like_app(conn, 'p1', 'Test Pipeline', [
        {'name': 'nav', 'trigger': '_run_', 'category': 'page_navigation'},
        {'name': 'ext', 'trigger': 'nav', 'category': 'link_extraction'},
    ])
    conn.close()

    conn2 = sqlite3.connect(db_path)
    count = conn2.execute("SELECT COUNT(*) FROM pipelines").fetchone()[0]
    tasks = conn2.execute("SELECT COUNT(*) FROM pipeline_tasks").fetchone()[0]
    conn2.close()

    check(count == 1, f"pipeline 존재: {count}")
    check(tasks == 2, f"pipeline_tasks 존재: {tasks}")

    # 정리
    for f in [db_path, db_path + '-wal', db_path + '-shm']:
        if os.path.exists(f): os.remove(f)

def test_wal_mode_autocommit():
    """테스트: WAL 모드에서 Auto-commit으로 저장 후 재연결"""
    print("\n[Test 2] WAL 모드 + Auto-commit (앱의 task 저장 방식)")
    db_path = os.path.join(tempfile.mkdtemp(), 'test2.db')

    conn = create_test_db(db_path, 'wal')
    save_task_like_app(conn, 't1', 'Test Task', 'crawl')
    conn.close()

    conn2 = sqlite3.connect(db_path)
    count = conn2.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    conn2.close()

    check(count == 1, f"task 존재: {count}")

    for f in [db_path, db_path + '-wal', db_path + '-shm']:
        if os.path.exists(f): os.remove(f)

def test_delete_mode_transaction():
    """테스트: DELETE 모드에서 Transaction으로 저장"""
    print("\n[Test 3] DELETE 모드 + Transaction")
    db_path = os.path.join(tempfile.mkdtemp(), 'test3.db')

    conn = create_test_db(db_path, 'delete', 'FULL')
    save_pipeline_like_app(conn, 'p1', 'Test Pipeline', [
        {'name': 'nav', 'trigger': '_run_', 'category': 'page_navigation'},
    ])
    conn.close()

    conn2 = sqlite3.connect(db_path)
    count = conn2.execute("SELECT COUNT(*) FROM pipelines").fetchone()[0]
    conn2.close()

    check(count == 1, f"pipeline 존재: {count}")

    for f in [db_path, db_path + '-journal']:
        if os.path.exists(f): os.remove(f)

def test_mixed_saves():
    """테스트: 같은 연결에서 pipeline(txn) + task(auto) 동시 저장"""
    print("\n[Test 4] 혼합 저장 (pipeline=txn, task=auto-commit)")
    db_path = os.path.join(tempfile.mkdtemp(), 'test4.db')

    conn = create_test_db(db_path, 'wal')
    save_pipeline_like_app(conn, 'p1', 'Mixed Pipeline', [
        {'name': 'nav', 'trigger': '_run_', 'category': 'page_navigation'},
    ])
    save_task_like_app(conn, 't1', 'Mixed Task', 'crawl')
    conn.close()

    conn2 = sqlite3.connect(db_path)
    p_count = conn2.execute("SELECT COUNT(*) FROM pipelines").fetchone()[0]
    t_count = conn2.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    conn2.close()

    check(p_count == 1, f"pipeline 존재: {p_count}")
    check(t_count == 1, f"task 존재: {t_count}")

    for f in [db_path, db_path + '-wal', db_path + '-shm']:
        if os.path.exists(f): os.remove(f)

def test_concurrent_read():
    """테스트: 한 연결이 열려 있는 동안 다른 연결에서 읽기"""
    print("\n[Test 5] 동시 접근 (쓰기 연결 유지 + 외부 읽기)")
    db_path = os.path.join(tempfile.mkdtemp(), 'test5.db')

    conn = create_test_db(db_path, 'wal')
    save_pipeline_like_app(conn, 'p1', 'Concurrent Test', [
        {'name': 'nav', 'trigger': '_run_', 'category': 'page_navigation'},
    ])
    # conn을 닫지 않고 외부에서 읽기
    conn2 = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
    count = conn2.execute("SELECT COUNT(*) FROM pipelines").fetchone()[0]
    conn2.close()

    check(count == 1, f"외부 읽기에서 pipeline 보임: {count}")

    # 이제 conn 닫기
    conn.close()

    for f in [db_path, db_path + '-wal', db_path + '-shm']:
        if os.path.exists(f): os.remove(f)

def test_wal_checkpoint():
    """테스트: WAL checkpoint 후 외부 읽기"""
    print("\n[Test 6] WAL checkpoint 후 파일 상태")
    db_path = os.path.join(tempfile.mkdtemp(), 'test6.db')

    conn = create_test_db(db_path, 'wal')
    save_pipeline_like_app(conn, 'p1', 'Checkpoint Test', [
        {'name': 'nav', 'trigger': '_run_', 'category': 'page_navigation'},
    ])

    # checkpoint 전 WAL 크기
    wal_before = os.path.getsize(db_path + '-wal') if os.path.exists(db_path + '-wal') else 0
    print(f"  checkpoint 전 WAL: {wal_before} bytes")

    # PASSIVE checkpoint (앱과 동일)
    conn.execute("PRAGMA wal_checkpoint(PASSIVE)")
    wal_after = os.path.getsize(db_path + '-wal') if os.path.exists(db_path + '-wal') else 0
    print(f"  PASSIVE 후 WAL: {wal_after} bytes")

    # TRUNCATE checkpoint
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    wal_final = os.path.getsize(db_path + '-wal') if os.path.exists(db_path + '-wal') else 0
    print(f"  TRUNCATE 후 WAL: {wal_final} bytes")

    conn.close()

    # 재연결
    conn2 = sqlite3.connect(db_path)
    count = conn2.execute("SELECT COUNT(*) FROM pipelines").fetchone()[0]
    conn2.close()

    check(count == 1, f"checkpoint 후 재연결에서 pipeline 존재: {count}")

    for f in [db_path, db_path + '-wal', db_path + '-shm']:
        if os.path.exists(f): os.remove(f)

def diagnose_app_db():
    """실제 앱 DB 진단"""
    print("\n[App DB] 실제 앱 DB 진단")

    config_path = os.path.join(os.environ.get('APPDATA', ''), 'sitecrawl', 'config.json')
    if not os.path.exists(config_path):
        print("  앱 config 파일 없음 (건너뜀)")
        return

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    storage_path = config.get('storagePath', '')
    print(f"  storagePath: {storage_path}")

    if not storage_path:
        print("  storagePath 비어있음!")
        return

    db_path = os.path.join(storage_path, 'sitecrawl.db')
    if not os.path.exists(db_path):
        print(f"  DB 파일 없음: {db_path}")
        return

    print(f"  DB 크기: {os.path.getsize(db_path)} bytes")

    wal = db_path + '-wal'
    shm = db_path + '-shm'
    print(f"  WAL: {'있음 ' + str(os.path.getsize(wal)) + 'B' if os.path.exists(wal) else '없음'}")
    print(f"  SHM: {'있음 ' + str(os.path.getsize(shm)) + 'B' if os.path.exists(shm) else '없음'}")

    conn = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
    cur = conn.cursor()

    cur.execute("PRAGMA journal_mode")
    jm = cur.fetchone()[0]
    print(f"  저널 모드: {jm}")

    cur.execute("PRAGMA synchronous")
    sync = cur.fetchone()[0]
    sync_names = {0: 'OFF', 1: 'NORMAL', 2: 'FULL', 3: 'EXTRA'}
    print(f"  synchronous: {sync_names.get(sync, sync)}")

    for table in ['pipelines', 'pipeline_tasks', 'tasks', 'crawl_history']:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            cnt = cur.fetchone()[0]
            status = 'OK' if cnt > 0 else 'EMPTY'
            print(f"  {table}: {cnt}행 [{status}]")
        except:
            print(f"  {table}: 테이블 없음")

    cur.execute("SELECT id, name FROM pipelines ORDER BY updated_at DESC")
    pipelines = cur.fetchall()
    if pipelines:
        for p in pipelines:
            print(f"    -> {p[1]} (id: {p[0][:20]}...)")
    else:
        print("    -> 파이프라인 데이터 없음!")
        print()
        print("  진단 결과:")
        print("  - tasks 테이블에 데이터가 있지만 pipelines에 없음")
        print("  - 가능한 원인:")
        print("    1. better-sqlite3 transaction이 WAL에 커밋되지만 fsync 안됨")
        print("    2. Electron 프로세스 종료 시 WAL이 제대로 flush 안됨")
        print("    3. journal_mode=DELETE + synchronous=FULL로 변경 권장")

    conn.close()

def main():
    print("=" * 60)
    print("Pipeline DB 영속성 진단 도구")
    print("=" * 60)

    test_wal_mode_transaction()
    test_wal_mode_autocommit()
    test_delete_mode_transaction()
    test_mixed_saves()
    test_concurrent_read()
    test_wal_checkpoint()

    if '--app-db' in sys.argv:
        diagnose_app_db()

    print()
    print("=" * 60)
    print(f"결과: {passed} passed, {failed} failed")
    if failed > 0:
        sys.exit(1)

if __name__ == '__main__':
    main()
