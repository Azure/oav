// @ts-check

/** @type {import('jest').Config} */
module.exports = {
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      useESM: true,
      tsconfig: "tsconfig.json",
    }],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json", "node"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  collectCoverage: true,
  collectCoverageFrom: ["./lib/**/*.ts", "!**/node_modules/**"],
  coverageReporters: ["json", "lcov", "cobertura", "text", "html", "clover"],
  coveragePathIgnorePatterns: ["/node_modules/", ".*/tests/.*"],
  testPathIgnorePatterns: [
    "/\\.autopull/",
    "/utilities.helpers.ts"
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup-file.cjs"],
  testMatch: ["**/test/**/*.ts", "!**/test/**/*.d.ts", "!**/test/sample.ts"],
  testTimeout: 999999,
  verbose: true,
};
