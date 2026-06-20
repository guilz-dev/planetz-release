import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, nativeImage } from 'electron'

const ICON_BASENAMES = ['icon.png', 'icon.icns'] as const

export type AppIconBasename = (typeof ICON_BASENAMES)[number]

/** Search roots for packaged main, electron-vite dev, and monorepo cwd. */
export function buildAppIconCandidates(basename: AppIconBasename, moduleDirname: string): string[] {
  return [
    join(moduleDirname, '../../resources', basename),
    join(process.cwd(), 'resources', basename),
    join(process.cwd(), 'apps/desktop/resources', basename),
  ]
}

export function resolveAppIconPath(
  basename: AppIconBasename,
  moduleDirname: string = import.meta.dirname,
): string | undefined {
  return buildAppIconCandidates(basename, moduleDirname).find((path) => existsSync(path))
}

/** macOS Dock ignores HTML favicon; set dock icon from PNG in dev and unpackaged runs. */
export function applyDarwinDockIcon(pngPath: string | undefined): void {
  if (process.platform !== 'darwin' || !pngPath) return
  const image = nativeImage.createFromPath(pngPath)
  if (image.isEmpty()) return
  app.dock?.setIcon(image)
}

export function resolveWindowIconPng(
  moduleDirname: string = import.meta.dirname,
): string | undefined {
  return resolveAppIconPath('icon.png', moduleDirname)
}
