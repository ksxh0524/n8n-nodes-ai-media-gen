module.exports = {
	parser: '@typescript-eslint/parser',
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
	],
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
		project: './tsconfig.json',
		tsconfigRootDir: __dirname,
		extraFileExtensions: ['.json'],
	},
	rules: {
		'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		'@typescript-eslint/no-explicit-any': 'warn',
		'no-console': 'error',
	},
	ignorePatterns: [
		'dist',
		'node_modules',
		'**/*.test.ts',
		'**/*.spec.ts',
		'coverage',
		'package.json',
	],
	// Don't report errors for eslint-disable comments of undefined rules
	reportUnusedDisableDirectives: false,
};
