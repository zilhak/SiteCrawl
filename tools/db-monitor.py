#!/usr/bin/env python3
"""
Pipeline DB 실시간 모니터링 도구

사용법:
  python tools/db-monitor.py                    # 기본 경로 자동 감지
  python tools/db-monitor.py F:\path\to\data    # 경로 직접 지정
  python tools/db-monitor.py --once             # 1회 확인 후 종료
  python tools/db-monitor.py --write-test       # 테스트 파이프라인 DB에 직접 기록
  python tools/db-monitor.py --clean-test       # 테스트 데이터 삭제

목적:
  앱이 실행 중일 때 외부에서 DB 상태를 확인하여
  파이프라인 저장 문제를 진단합니다.
"""

import sqlite3
import os
import sys
import time
import json

def get_default_db_path():
    """electron-store config에서 storagePath 읽기"""
    config_path = os.path.join(
        os.environ.get('APPDATA', ''),
        'sitecrawl', 'config.json'
    )
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            storage = config.get('storagePath', '')
            if storage:
                return os.path.join(storage, 'sitecrawl.db')
    return None

def check_db(db_path, verbose=True):
    """DB 상태 확인"""
    if not os.path.exists(db_path):
        print(f"  DB 파일 없음: {db_path}")
        return None

    info = {
        'file_size': os.path.getsize(db_path),
        'file_mtime': os.path.getmtime(db_path),
        'wal_size': 0,
        'shm_size': 0,
        'journal_mode': '',
        'tables': {},
        'pipelines': [],
    }

    wal = db_path + '-wal'
    shm = db_path + '-shm'
    if os.path.exists(wal):
        info['wal_size'] = os.path.getsize(wal)
    if os.path.exists(shm):
        info['shm_size'] = os.path.getsize(shm)

    try:
        conn = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
        cur = conn.cursor()

        cur.execute("PRAGMA journal_mode")
        info['journal_mode'] = cur.fetchone()[0]

        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        for (name,) in cur.fetchall():
            cur.execute(f'SELECT COUNT(*) FROM "{name}"')
            info['tables'][name] = cur.fetchone()[0]

        if 'pipelines' in info['tables']:
            cur.execute("SELECT id, name, updated_at FROM pipelines ORDER BY updated_at DESC")
            info['pipelines'] = [
                {'id': r[0], 'name': r[1], 'updated_at': r[2]}
                for r in cur.fetchall()
            ]

        conn.close()
    except Exception as e:
        print(f"  DB 읽기 오류: {e}")
        return None

    if verbose:
        mtime_str = time.strftime('%H:%M:%S', time.localtime(info['file_mtime']))
        print(f"  DB: {info['file_size']:,}B (수정: {mtime_str}) | WAL: {info['wal_size']}B | SHM: {info['shm_size']}B | 모드: {info['journal_mode']}")

        important_tables = ['pipelines', 'pipeline_tasks', 'tasks', 'crawl_history']
        parts = [f"{t}:{info['tables'].get(t, '?')}" for t in important_tables]
        print(f"  행수: {' | '.join(parts)}")

        if info['pipelines']:
            for p in info['pipelines']:
                ts = time.strftime('%H:%M:%S', time.localtime(p['updated_at'] / 1000))
                print(f"  -> [{ts}] {p['name']} (id: {p['id'][:12]}...)")
        else:
            print("  -> 파이프라인 없음")

    return info

def write_test(db_path):
    """테스트 파이프라인 직접 기록"""
    conn = sqlite3.connect(db_path)
    test_id = f'dbmon_test_{int(time.time())}'
    now = int(time.time() * 1000)

    conn.execute(
        'INSERT INTO pipelines (id, name, description, created_at, updated_at) VALUES (?,?,?,?,?)',
        (test_id, '[DB모니터] 테스트 파이프라인', '모니터 도구에서 직접 기록', now, now)
    )
    conn.execute(
        'INSERT INTO pipeline_tasks (pipeline_id, name, trigger_name, category, task_config, phase) VALUES (?,?,?,?,?,?)',
        (test_id, 'test_nav', '_run_', 'page_navigation', '{"waitUntil":"domcontentloaded"}', 'process')
    )
    conn.commit()
    conn.close()
    print(f"  테스트 파이프라인 기록됨: {test_id}")
    print(f"  앱에서 파이프라인 목록을 새로고침하여 이 데이터가 보이는지 확인하세요.")
    return test_id

def clean_test(db_path):
    """테스트 데이터 삭제"""
    conn = sqlite3.connect(db_path)
    conn.execute("DELETE FROM pipeline_tasks WHERE pipeline_id LIKE 'dbmon_test%'")
    conn.execute("DELETE FROM pipelines WHERE id LIKE 'dbmon_test%'")
    conn.commit()
    conn.close()
    print("  테스트 데이터 삭제 완료")

def monitor(db_path, interval=2):
    """실시간 모니터링"""
    print(f"실시간 모니터링 시작 (Ctrl+C로 종료)")
    print(f"DB: {db_path}")
    print(f"갱신 간격: {interval}초")
    print("=" * 60)

    prev_info = None
    try:
        while True:
            now = time.strftime('%H:%M:%S')
            print(f"\n[{now}]")
            info = check_db(db_path)

            if prev_info and info:
                # 변경 감지
                for table in ['pipelines', 'pipeline_tasks']:
                    old_count = prev_info['tables'].get(table, 0)
                    new_count = info['tables'].get(table, 0)
                    if old_count != new_count:
                        diff = new_count - old_count
                        sign = '+' if diff > 0 else ''
                        print(f"  *** {table} 변경: {old_count} -> {new_count} ({sign}{diff}) ***")

                if prev_info['wal_size'] != info['wal_size']:
                    print(f"  *** WAL 크기 변경: {prev_info['wal_size']} -> {info['wal_size']} ***")

                if prev_info['file_size'] != info['file_size']:
                    print(f"  *** DB 파일 크기 변경: {prev_info['file_size']} -> {info['file_size']} ***")

            prev_info = info
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n모니터링 종료")

def main():
    args = sys.argv[1:]

    # 옵션 파싱
    once = '--once' in args
    do_write = '--write-test' in args
    do_clean = '--clean-test' in args

    # 경로 결정
    path_args = [a for a in args if not a.startswith('--')]
    if path_args:
        storage_path = path_args[0]
        db_path = os.path.join(storage_path, 'sitecrawl.db') if not storage_path.endswith('.db') else storage_path
    else:
        db_path = get_default_db_path()
        if not db_path:
            print("DB 경로를 찾을 수 없습니다. 경로를 직접 지정해주세요.")
            print("사용법: python tools/db-monitor.py <storage_path>")
            sys.exit(1)

    print(f"DB 경로: {db_path}")
    print()

    if do_write:
        write_test(db_path)
    elif do_clean:
        clean_test(db_path)
    elif once:
        check_db(db_path)
    else:
        monitor(db_path)

if __name__ == '__main__':
    main()
