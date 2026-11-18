export const plural = (count: number, word: string, pluralWord = `${word}s`) =>
  `${count} ${count === 1 ? word : pluralWord}`
