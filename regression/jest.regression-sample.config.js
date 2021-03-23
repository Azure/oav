// @ts-check

const mainConfig = require("../jest.config");

/** @type {jest.InitialOptions} */
module.exports = {
  ...mainConfig,
  testMatch: ["**/regression/**/validateExamplesRegression_latestOnly.test.ts"],
  setupFiles: ["./jest.setup-file.js"],
};
