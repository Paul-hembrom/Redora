// eslint.config.mjs
export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "AssignmentExpression[left.object.name='document'][left.property.name='cookie']",
        message: 'Do not write cookies from client JS. Session cookies (sb-org-id, sb-role, token) are set server-side with domain=.alphanexoraai.com and httpOnly. Use POST /api/session/org instead.',
      }],
    },
  },
];
