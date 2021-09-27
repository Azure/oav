// /*
// 👋 Hi! This file was autogenerated by tslint-to-eslint-config.
// https://github.com/typescript-eslint/tslint-to-eslint-config

// It represents the closest reasonable ESLint configuration to this
// project's original TSLint configuration.

// We recommend eventually switching this configuration to extend from
// the recommended rulesets in typescript-eslint.
// https://github.com/typescript-eslint/tslint-to-eslint-config/blob/master/docs/FAQs.md

// Happy linting! 💖
// */

import("@rushstack/eslint-config/patch/modern-module-resolution");
module.exports = {
    env: {
      browser: true,
      es6: true,
      node: true,
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
      sourceType: "module",
      tsconfigRootDir: __dirname,
    },
    plugins: ["@typescript-eslint", "import", "prettier"],
    extends: [
      "@rushstack/eslint-config/profile/node",
      "plugin:prettier/recommended",
      "plugin:import/errors",
      "plugin:import/warnings",
      "plugin:import/typescript",
    ],
    rules: {
      "import/order": "error",
      "import/namespace": "off",
      "@typescript-eslint/typedef": "off",
      "@typescript-eslint/naming-convention": "off",
      "@rushstack/no-new-null": "off",
      "@rushstack/typedef-var": "off",
      "@rushstack/security/no-unsafe-regexp": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-parameter-properties": "off",
      "@typescript-eslint/array-type": [
        "error",
        {
          default: "array-simple",
        },
      ],
    },
  };
