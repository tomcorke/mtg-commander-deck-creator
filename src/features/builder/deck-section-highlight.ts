export function openSectionsWithHighlights(
  sections: Iterable<{ open: boolean; querySelector: (selector: string) => unknown }>,
) {
  for (const section of sections)
    if (section.querySelector('[data-highlighted]')) section.open = true
}
