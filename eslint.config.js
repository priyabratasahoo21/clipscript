import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['dist/**', 'node_modules/**', 'out/**'] },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module'
        },
        rules: {
            eqeqeq: ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-implicit-globals': 'error',
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'no-script-url': 'error',
            'no-param-reassign': ['error', { props: false }],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-restricted-properties': ['error',
                { property: 'innerHTML', message: 'Build DOM with h()/textContent so clip content is never parsed as HTML.' },
                { property: 'outerHTML', message: 'Build DOM with h()/textContent.' },
                { property: 'insertAdjacentHTML', message: 'Build DOM with h()/textContent.' }
            ],
            'no-restricted-syntax': ['error',
                { selector: "CallExpression[callee.property.name='write'][callee.object.name='document']", message: 'document.write is not allowed.' }
            ]
        }
    },
    {
        files: ['src/**/*.js'],
        languageOptions: { globals: { ...globals.browser } }
    },
    {
        files: ['bin/**/*.mjs', 'cli/**/*.mjs', 'scripts/**/*.mjs', 'test/**/*.mjs', 'eslint.config.js'],
        languageOptions: { globals: { ...globals.node } }
    },
    {
        files: ['test/browser/**/*.mjs'],
        languageOptions: { globals: { ...globals.node, ...globals.browser } }
    }
];
