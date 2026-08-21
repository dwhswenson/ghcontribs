import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

const styleUrl = new URL('../src/style.css', import.meta.url)

describe('layout motion styles', () => {
  it('centralizes geometry transition timing and respects reduced motion', async () => {
    const css = await readFile(styleUrl, 'utf8')

    expect(css).toContain('--ghc-layout-duration: 360ms')
    expect(css).toContain('transition-property: left, top, width, height')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*--ghc-layout-duration: 0ms/,
    )
  })
})
