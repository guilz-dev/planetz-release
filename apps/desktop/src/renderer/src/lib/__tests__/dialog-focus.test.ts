// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { trapDialogTabKey } from '../dialog-focus.js'
import { getFocusableElements } from '../focusable-elements.js'

function appendButtons(panel: HTMLElement, labels: string[]): void {
  for (const label of labels) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    panel.appendChild(button)
  }
}

describe('dialog-focus', () => {
  it('lists footer buttons in document order', () => {
    const panel = document.createElement('div')
    appendButtons(panel, ['Cancel', 'Append', 'Replace'])
    const focusable = getFocusableElements(panel)
    expect(focusable.map((el) => el.textContent)).toEqual(['Cancel', 'Append', 'Replace'])
  })

  it('wraps Tab from last focusable to first', () => {
    const panel = document.createElement('div')
    appendButtons(panel, ['First', 'Last'])
    document.body.appendChild(panel)
    const [first, last] = getFocusableElements(panel)
    last.focus()

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    trapDialogTabKey(event, panel)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    panel.remove()
  })
})
