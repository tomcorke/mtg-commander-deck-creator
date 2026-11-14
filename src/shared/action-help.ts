/**
 * Shows every `.action-help` tooltip in the top layer, so no header, sticky bar, stacking context
 * or scroll container can cover or clip it, and places it beside its anchor inside the viewport.
 *
 * Markup stays as before: the tooltip is a child of its trigger or of a positioned wrapper. It shows
 * while that parent is hovered, the trigger has keyboard focus, or a synergy badge holds focus. The
 * anchor is the nearest positioned ancestor, the box the old absolute placement measured from.
 * Placement classes set width and two optional custom properties:
 * `--action-help-side` (`above`, the default; `below`; or `inline-end`) and
 * `--action-help-align` (`center`, the default; `start`; or `end`).
 */

export type Box = { top: number; right: number; bottom: number; left: number }
export type ActionHelpSide = 'above' | 'below' | 'inline-end'
export type ActionHelpAlign = 'center' | 'start' | 'end'

// Gap between the anchor and the tooltip, and the minimum distance from each viewport edge.
const gap = 8
const edge = 16

const clamp = (value: number, size: number, extent: number) =>
  Math.max(edge, Math.min(value, extent - size - edge))

/**
 * Returns the tooltip's viewport position. A block placement flips to the other side when the
 * preferred side lacks room; `inline-end` falls back to an end-aligned block placement when the
 * tooltip does not fit beside the anchor. The result is clamped inside the viewport.
 */
export function placeActionHelp(
  anchor: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  side: ActionHelpSide = 'above',
  align: ActionHelpAlign = 'center',
): { top: number; left: number; side: 'above' | 'below' | 'inline-end' } {
  if (side === 'inline-end' && anchor.right + gap + size.width <= viewport.width - edge)
    return {
      top: clamp((anchor.top + anchor.bottom - size.height) / 2, size.height, viewport.height),
      left: anchor.right + gap,
      side,
    }
  if (side === 'inline-end') {
    side = 'above'
    align = 'end'
  }
  const room = {
    above: anchor.top - gap - edge,
    below: viewport.height - anchor.bottom - gap - edge,
  }
  const other = side === 'above' ? 'below' : 'above'
  const block =
    room[side] >= size.height
      ? side
      : room[other] >= size.height || room[other] > room[side]
        ? other
        : side
  const left =
    align === 'start'
      ? anchor.left
      : align === 'end'
        ? anchor.right - size.width
        : (anchor.left + anchor.right - size.width) / 2
  return {
    top: clamp(
      block === 'above' ? anchor.top - gap - size.height : anchor.bottom + gap,
      size.height,
      viewport.height,
    ),
    left: clamp(left, size.width, viewport.width),
    side: block,
  }
}

const shownSelector = [
  ':hover > .action-help',
  ':focus-visible + .action-help',
  ':focus-visible > .action-help',
  // Synergy also opens on click or tap, as before #282.
  '.synergy-info:focus-within > .action-help',
].join(', ')

function anchorOf(tooltip: HTMLElement) {
  for (let element = tooltip.parentElement; element; element = element.parentElement)
    if (element === document.body || getComputedStyle(element).position !== 'static') return element
  return tooltip.parentElement
}

function position(tooltip: HTMLElement) {
  const anchor = anchorOf(tooltip)
  if (!anchor) return
  const style = getComputedStyle(tooltip)
  const { width, height } = tooltip.getBoundingClientRect()
  const placed = placeActionHelp(
    anchor.getBoundingClientRect(),
    { width, height },
    { width: document.documentElement.clientWidth, height: window.innerHeight },
    (style.getPropertyValue('--action-help-side').trim() || 'above') as ActionHelpSide,
    (style.getPropertyValue('--action-help-align').trim() || 'center') as ActionHelpAlign,
  )
  tooltip.style.top = `${placed.top}px`
  tooltip.style.left = `${placed.left}px`
  tooltip.dataset.side = placed.side
}

/** Shows, hides and places tooltips to match hover and focus; call once per document. */
export function syncActionHelp(root: ParentNode = document) {
  for (const tooltip of root.querySelectorAll<HTMLElement>('.action-help')) {
    const open = tooltip.matches(':popover-open')
    if (!tooltip.matches(shownSelector)) {
      if (open) tooltip.hidePopover()
      continue
    }
    if (!open) {
      tooltip.popover ??= 'manual'
      tooltip.showPopover()
    }
    position(tooltip)
  }
}

/** Keeps tooltips in step with pointer, focus, DOM, scroll and resize changes. */
export function installActionHelp() {
  let frame = 0
  const schedule = () => {
    frame ||= requestAnimationFrame(() => {
      frame = 0
      syncActionHelp()
    })
  }
  for (const name of ['pointerover', 'pointerout', 'focusin', 'focusout', 'scroll'])
    document.addEventListener(name, schedule, { capture: true, passive: true })
  window.addEventListener('resize', schedule)
  // Inline confirmations render under a pointer that has not moved.
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true })
}
