import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  {
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    rules: {
      'react/prop-types': 'off',
    },
  },
  prettierConfig,
  {
    ignores: ['dist/', 'node_modules/'],
  },
]
