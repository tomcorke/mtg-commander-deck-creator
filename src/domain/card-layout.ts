const doubleFacedLayouts = new Set(['transform', 'modal_dfc', 'meld', 'double_faced_token'])

export const hasBackFace = (layout: string | undefined) => doubleFacedLayouts.has(layout ?? '')
