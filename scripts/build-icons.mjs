import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const pub = path.join(root, 'public')

async function main() {
  const traySvg = path.join(pub, 'tray-icon.svg')
  const appSvg = path.join(pub, 'app-icon.svg')
  if (!fs.existsSync(traySvg) || !fs.existsSync(appSvg)) {
    console.error('Missing SVG sources in public/')
    process.exit(1)
  }

  await sharp(traySvg).resize(64, 64).png().toFile(path.join(pub, 'trayTemplate.png'))
  await sharp(appSvg).resize(256, 256).png().toFile(path.join(pub, 'app-icon.png'))
  /** 44×44 px, scaleFactor 2 in Electron → 22×22 pt (matches native menu bar). Black + alpha for NS template. */
  await sharp(traySvg).resize(44, 44).png().toFile(path.join(pub, 'tray-menu.png'))
  console.log(
    'Wrote public/trayTemplate.png (64×64), public/app-icon.png (256×256), public/tray-menu.png (44×44 template)',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
