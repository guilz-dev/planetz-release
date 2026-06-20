import { parseYamlSection, valueToYamlText } from '@planetz/shared'

/** Serialize an advanced workflow section for the YAML textarea editor. */
export function advancedSectionToYaml(value: unknown): string {
  return valueToYamlText(value)
}

/** Parse advanced section textarea; empty input clears the section. */
export function parseAdvancedSectionYaml(text: string): unknown | undefined {
  return parseYamlSection(text)
}
