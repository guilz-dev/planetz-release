/** Sentinel written at the top of managed spec-driven workflow YAML. */
export const SPEC_DRIVEN_INSTALLER_SENTINEL_PREFIX = '# managed-by: spec-driven-installer v'

/** Bump when installer-managed workflow/facets change incompatibly. */
export const SPEC_DRIVEN_INSTALLER_VERSION = 8

export const SPEC_DRIVEN_INSTALLER_SENTINEL = `${SPEC_DRIVEN_INSTALLER_SENTINEL_PREFIX}${SPEC_DRIVEN_INSTALLER_VERSION}`

export function specDrivenWorkflowHasCurrentInstallerVersion(yaml: string): boolean {
  const firstLine = yaml.split('\n', 1)[0]?.trim() ?? ''
  return firstLine === SPEC_DRIVEN_INSTALLER_SENTINEL
}
