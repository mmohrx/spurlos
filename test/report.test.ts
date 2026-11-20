import { expect, test } from 'vitest'
import type { Result } from '../src/checks.ts'
import { clean, text } from '../src/report.ts'
import type { Scan } from '../src/scan.ts'

test('what the page says cannot steer the terminal', () => {
  const evil = 'WordPress\x1b[2J\x1b]8;;https://evil.example\x07 6.2‮gnp.exe'
  const scan = { url: 'https://shop.example/', finalUrl: 'https://shop.example/\x1b[31m', settled: true } as Scan
  const results: Result[] = [
    { check: 'disclosure', level: 'yellow', findings: [{ source: 'meta', name: 'generator', value: evil, version: true }] },
  ] as Result[]
  for (const color of [false, true]) {
    const report = text(scan, results, 'de', { color })
    expect(report).toContain('WordPress�[2J�]8;;https://evil.example� 6.2�gnp.exe')
    expect(report).not.toContain('\x1b[2J')
    expect(report).not.toContain('\x07')
    expect(report).not.toContain('‮')
    expect(report).not.toContain('/\x1b[31m')
  }
  expect(clean('Größe „ok“ – fine')).toBe('Größe „ok“ – fine')
})
