/**
 * ResultStore - 파이프라인 실행 중 데이터 축적 저장소
 *
 * 생명주기: 파이프라인 실행 1회 (시작 시 생성, 종료 시 소멸)
 * 불변성: copy-on-read/write 전략
 * 순서: Map<number, TaskData>로 삽입 순서 보장
 */

import type { TaskData } from './types'

export class ResultStore {
  private items: Map<number, TaskData>
  private nextIndex: number

  constructor() {
    this.items = new Map()
    this.nextIndex = 0
  }

  /**
   * 특정 인덱스에 데이터 저장 (copy-on-write)
   */
  set(index: number, data: TaskData): void {
    this.items.set(index, this.copyData(data))
    if (index >= this.nextIndex) {
      this.nextIndex = index + 1
    }
  }

  /**
   * 마지막 인덱스에 데이터 추가 (append)
   * @returns 저장된 인덱스
   */
  append(data: TaskData): number {
    const index = this.nextIndex
    this.items.set(index, this.copyData(data))
    this.nextIndex++
    return index
  }

  /**
   * 특정 인덱스의 데이터 조회 (copy-on-read)
   */
  get(index: number): TaskData | null {
    const data = this.items.get(index)
    if (!data) return null
    return this.copyData(data)
  }

  /**
   * 전체 데이터를 삽입 순서대로 반환 (복사본)
   */
  getAll(): TaskData[] {
    const result: TaskData[] = []
    for (const data of this.items.values()) {
      result.push(this.copyData(data))
    }
    return result
  }

  /**
   * 저장된 항목 수
   */
  length(): number {
    return this.items.size
  }

  /**
   * 전체 초기화
   */
  clear(): void {
    this.items.clear()
    this.nextIndex = 0
  }

  /**
   * TaskData 깊은 복사 (불변성 원칙)
   */
  private copyData(data: TaskData): TaskData {
    switch (data.type) {
      case 'empty':
        return { type: 'empty', value: null }
      case 'url':
        return { type: 'url', value: data.value }
      case 'strings':
        return { type: 'strings', value: [...data.value] }
      case 'urls':
        return { type: 'urls', value: [...data.value] }
      case 'page':
        // Page 객체는 복사 불가 (Playwright 리소스), 참조 공유
        return { type: 'page', value: data.value }
    }
  }
}
