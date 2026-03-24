// @ts-check

const mainConfig = require("../jest.config.cjs");

/** @type {import('jest').Config} */
module.exports = {
  ...mainConfig,
  testMatch: ["**/regression/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/../jest.setup-file.cjs"]
};
