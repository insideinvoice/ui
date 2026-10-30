import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/vendor']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // ignoreRestSiblings: the `const { derived, ...rest }` idiom intentionally
      // extracts fields to OMIT them (see contentSignature in InvoiceForm.jsx);
      // without this, every intentionally-dropped key reports as unused.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }],
    },
  },
  {
    // Vite executes its config in Node, not the browser — `process.cwd()`
    // there is legitimate, so it needs node globals rather than browser ones.
    files: ['vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
