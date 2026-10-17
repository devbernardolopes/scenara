import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

const sharedFiles = ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs']

export default [
  { files: sharedFiles, ...js.configs.recommended },
  { files: sharedFiles, ...reactPlugin.configs.flat.recommended },
  { files: sharedFiles, ...reactPlugin.configs.flat['jsx-runtime'] },
  {
    files: sharedFiles,
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: sharedFiles,
    rules: { 'react/prop-types': 'off' },
  },
  { files: sharedFiles, ...prettierConfig },
  {
    files: sharedFiles,
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Node scripts (pre-commit hooks) rely on __dirname/process rather than
    // the browser API.
    files: ['scripts/**/*.{js,cjs,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  { ignores: ['dist/', 'node_modules/', 'api/'] },
]
