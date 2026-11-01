// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Confini fra pacchetti (ARCHITECTURE.md §4): un pacchetto può importare solo quelli sotto di lui.
 *   core  ← data ← (sim, persistence) ← game ← engine-host ← apps
 */
const boundary = (allowed) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['@lean-angle/*', ...allowed.map((p) => `!@lean-angle/${p}`)],
          message: 'Import non consentito dai confini dei pacchetti (vedi docs/ARCHITECTURE.md §4).',
        },
      ],
    },
  ],
});

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'docs/**', 'export/**', 'assets/**', 'tools/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },
  { files: ['packages/core/src/**/*.ts'], rules: boundary([]) },
  { files: ['packages/data/src/**/*.ts'], rules: boundary(['core']) },
);
