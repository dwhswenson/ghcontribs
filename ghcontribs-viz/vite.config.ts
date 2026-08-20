import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const dataDirectory = resolve(
    process.cwd(),
    environment.GHCONTRIBS_VIZ_DATA_DIR ?? '../dist-data',
  )

  return {
    publicDir: existsSync(dataDirectory) ? dataDirectory : false,
  }
})
