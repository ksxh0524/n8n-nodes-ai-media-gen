/* eslint-disable @n8n/community-nodes/no-restricted-globals */
// Test setup file - requires access to global and process
global.console = {
	...console,
	error: jest.fn(),
	warn: jest.fn(),
};

process.env.NODE_ENV = 'test';
