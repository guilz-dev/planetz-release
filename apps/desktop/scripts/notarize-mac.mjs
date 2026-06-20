import { notarize } from '@electron/notarize'

function hasAppleNotarizeCredentials() {
  return Boolean(
    process.env.APPLE_ID?.trim() &&
      process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim() &&
      process.env.APPLE_TEAM_ID?.trim(),
  )
}

/** @param {import('electron-builder').AfterSignContext} context */
export default async function notarizeMac(context) {
  if (context.electronPlatformName && context.electronPlatformName !== 'darwin') return

  if (!hasAppleNotarizeCredentials()) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      throw new Error(
        '[notarize] APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID are required in GitHub Actions',
      )
    }
    console.log('[notarize] skip: Apple notarize credentials not configured')
    return
  }

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  console.log(`[notarize] submitting ${appPath}`)

  await notarize({
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  })

  console.log('[notarize] complete')
}
