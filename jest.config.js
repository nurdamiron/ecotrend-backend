// jest.config.js
module.exports = {
    testEnvironment: 'node',
    testMatch: [
      '**/tests/**/*.test.js',
      '**/tests/**/*.spec.js'
    ],
    verbose: true,
    forceExit: true,
    testTimeout: 60000
  };