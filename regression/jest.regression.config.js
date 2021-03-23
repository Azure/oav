// @ts-check

const mainConfig = require("../jest.config");

/** @type {jest.InitialOptions} */
module.exports = {
  ...mainConfig,
  testMatch: ["**/regression/**/*.test.ts"],
  setupFiles: ["./jest.setup-file.ts"],
};
