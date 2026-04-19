/**
 * Ad-hoc sign the .app bundle on macOS so Gatekeeper is less likely to report
 * “damaged and can’t be opened” for unsigned CI builds (still not notarized).
 * @param {import('electron-builder').AfterSignContext} context
 */
module.exports = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== "darwin") return

  const path = require("node:path")
  const fs = require("node:fs")
  const { execSync } = require("node:child_process")

  const name = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(appOutDir, name)
  if (!fs.existsSync(appPath)) {
    console.warn(`[afterSign] App not found: ${appPath}`)
    return
  }
  console.log(`[afterSign] Ad-hoc codesign: ${appPath}`)
  execSync(`codesign --sign - --force --deep "${appPath}"`, { stdio: "inherit" })
}
