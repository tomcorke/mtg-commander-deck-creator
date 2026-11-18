/** Conservative text heuristic, not a rules interaction evaluator. */
type TextCard = { name: string; detail: string }

const conditions = [
  {
    label: 'combat damage to a player',
    trigger:
      /\b(?:when|whenever) (?:it|~|a creature you control|one or more creatures you control) deals? combat damage to (?:a player|one or more players|an opponent|one of your opponents)\b/i,
    payoff:
      /\bwhenever (?:a creature|one or more creatures|a creature you control|one or more creatures you control) deals? combat damage to (?:a player|one or more players|an opponent|one of your opponents)\b/i,
    repeat:
      /\b(?:a |one or more )?creatures? you control dealing combat damage to (?:a player|one or more players|an opponent|one of your opponents) causes? a triggered ability[^.\n]*triggers? an additional time/i,
  },
  {
    label: 'lands entering under your control',
    trigger:
      /\b(?:when|whenever) (?:a land|one or more lands) enters?(?: the battlefield)? under your control\b/i,
  },
  {
    label: 'creatures you control dying',
    trigger: /\b(?:when|whenever) (?:another |a |one or more )?creatures? you control dies?\b/i,
  },
]

export function commanderTriggerLink(card: TextCard, commanders: TextCard[]): string | undefined {
  const clean = (text: string) => text.replace(/\([^)]*\)/g, '')
  for (const commander of commanders) {
    if (card === commander) continue
    const text = clean(commander.detail)
      .replaceAll(commander.name, '~')
      .replaceAll(commander.name.split(',')[0], '~')
    for (const condition of conditions) {
      if (!condition.trigger.test(text)) continue
      const payoff = clean(card.detail)
      if ((condition.payoff ?? condition.trigger).test(payoff) || condition.repeat?.test(payoff))
        return `Heuristic commander link: shares or repeats the commander's ${condition.label} trigger.`
    }
  }
  return undefined
}
