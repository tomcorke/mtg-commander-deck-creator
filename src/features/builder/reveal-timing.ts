export const flipDuration = 750
export const flipStagger = 180

export function revealFrame(elapsed: number, rolling: boolean) {
  const leaving = rolling && elapsed < flipDuration
  const progress = Math.max(
    0,
    Math.min(1, (elapsed - (rolling && !leaving ? flipDuration : 0)) / flipDuration),
  )
  const eased = progress * progress * (3 - 2 * progress)
  const angle = leaving ? Math.PI * eased : rolling ? Math.PI * (1 + eased) : Math.PI * (1 - eased)
  return {
    phase: leaving ? 'leaving' : 'entering',
    side: leaving ? (eased < 0.5 ? 'old' : 'back') : eased < 0.5 ? 'back' : 'new',
    angle: -angle,
    oldOpacity: leaving ? Math.max(0, 1 - progress / 0.6) : 0,
    newOpacity: leaving ? 0 : Math.max(0, Math.min(1, (progress - 0.35) / 0.45)),
    done: !leaving && progress === 1,
  }
}
