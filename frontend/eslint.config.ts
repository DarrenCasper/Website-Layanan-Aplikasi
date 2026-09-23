import js from '@eslint/js'
import prettier from 'eslint-config-prettier/flat'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules', '.pi']),

  // Application and config sources.
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },
  },

  ...tseslint.configs.recommended,

  // React component sources.
  {
    files: ['**/*.{jsx,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
  },

  // Build tooling and this config file run on Node.
  {
    files: ['**/*.config.{js,ts,mts,cts}', 'eslint.config.ts'],
    languageOptions: { globals: globals.node },
  },

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Must stay last so formatting rules never conflict with Prettier.
  prettier,
])
