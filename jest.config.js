// @ts-check

/** @type {jest.InitialOptions} */
module.exports = {
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json", "node"],
  moduleNameMapper: {},
  collectCoverage: true,
  collectCoverageFrom: ["./lib/**/*.ts", "!**/node_modules/**"],
  coverageReporters: ["json", "lcov", "cobertura", "text", "html", "clover"],
  coveragePathIgnorePatterns: ["/node_modules/", ".*/tests/.*"],
  globals: {
    "ts-jest": {
      tsConfig: "tsconfig.json",
    },
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup-file.js"],
  testMatch: ["**/test/**/liveValidatorTests.ts", "**/test/**/roundtripValidatorTests.ts"],
  verbose: true,
};
