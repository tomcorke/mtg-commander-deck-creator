import tsParser from '@typescript-eslint/parser'
import sonarjs from 'eslint-plugin-sonarjs'

export default [
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: { sonarjs },
    rules: {
      'max-depth': ['error', 4],
      'max-lines-per-function': [
        'error',
        { IIFEs: true, max: 100, skipBlankLines: true, skipComments: true },
      ],
      'max-nested-callbacks': ['error', 3],
      'sonarjs/cognitive-complexity': ['error', 15],
    },
  },
  {
    // JSX layout length is driven by markup; keep complexity rules for its hooks and helpers.
    files: ['src/features/**/*.tsx'],
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'sonarjs/cognitive-complexity': 'off',
    },
  },
]
