// @ts-check

const mainConfig = require("../jest.config");

/** @type {jest.InitialOptions} */
module.exports = {
  ...mainConfig,
  testMatch: ["**/regression/**/validateExamplesRegression_latestOnly.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/../jest.setup-file.js"],
};
