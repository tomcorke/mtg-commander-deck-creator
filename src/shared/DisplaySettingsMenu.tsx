import { useEffect, useId, useRef, useState } from 'react'
import { useVisualPreferences } from './VisualPreferencesContext.tsx'

export function DisplaySettingsMenu() {
  const preferences = useVisualPreferences()
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    wrapper.current?.querySelector<HTMLInputElement>('input')?.focus()
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const controls = [
    ['Dark mode', preferences.darkMode, preferences.setDarkMode],
    ['Commander art and colours', preferences.commanderStyling, preferences.setCommanderStyling],
    ['Motion and finishes', preferences.cardEffects, preferences.setCardEffects],
  ] as const
  return (
    <div
      className="display-settings"
      ref={wrapper}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          close()
        }
      }}
    >
      <button
        ref={trigger}
        className="export"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        Display
      </button>
      {open && (
        <div id={id} className="display-settings-panel" role="group" aria-label="Display settings">
          {controls.map(([label, checked, setValue]) => (
            <label key={label}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => setValue(event.target.checked)}
              />{' '}
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
