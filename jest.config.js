module.exports = {
  testEnvironment: `node`,
  testMatch: [`**/*.test.ts`],
  moduleNameMapper: {
    "\\.md": `<rootDir>/empty-module.js`,
  },
  testTimeout: 30000,
};
