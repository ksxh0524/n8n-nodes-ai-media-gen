global.console = {
	...console,
	error: jest.fn(),
	warn: jest.fn(),
};

process.env.NODE_ENV = 'test';
