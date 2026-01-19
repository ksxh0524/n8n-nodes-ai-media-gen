/**
 * Jest Setup File
 */

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  // Keep info and log for debugging
};

// Mock environment variables
process.env.NODE_ENV = 'test';
