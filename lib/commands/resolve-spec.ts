// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { log } from "../util/logging"
import * as validate from "../validate"
import * as yargs from "yargs"
import { cliSuppressExceptions } from '../cliSuppressExceptions'

export const command = "resolve-spec <spec-path>"

export const describe =
  "Resolves the swagger spec based on the selected options like allOfs, relativePaths, " +
  "examples etc."

export const builder: yargs.CommandBuilder = {
  a: {
    alias: "additionalPropertiesFalse",
    describe: "Should additionalProperties be set to false?",
    boolean: true,
    default: false,
  },
  e: {
    alias: "examples",
    describe: "Should x-ms-examples be resolved?",
    boolean: true,
    default: false,
  },
  o: {
    alias: "allOf",
    describe: "Should allOf references be resolved?",
    boolean: true,
    default: false,
  },
  p: {
    alias: "pureObjects",
    describe: "Should pure objects be resolved?",
    boolean: true,
    default: false,
  },
  r: {
    alias: "relativePaths",
    describe: "Should relative paths be resolved?",
    boolean: true,
    default: false,
  },
  c: {
    alias: "discriminator",
    describe: "Should discriminator be resolved?",
    boolean: true,
    default: false,
  },
  t: {
    alias: "parameterizedHost",
    describe: 'Should "x-ms-parameterized-host" extension be resolved?',
    boolean: true,
    default: false,
  },
  n: {
    alias: "nullable",
    describe: "Should nullable types be resolved?",
    boolean: true,
    default: false,
  },
  d: {
    alias: "outputDir",
    describe: "Output directory where the resolved swagger spec will be stored.",
    string: true,
    default: "./",
  },
}

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(
    async () => {
      log.debug(argv.toString())
      const specPath = argv.specPath
      const vOptions = {
        consoleLogLevel: argv.logLevel,
        logFilepath: argv.f,
        shouldResolveRelativePaths: argv.r,
        shouldResolveXmsExamples: argv.e,
        shouldResolveAllOf: argv.o,
        shouldSetAdditionalPropertiesFalse: argv.a,
        shouldResolveParameterizedHost: argv.t,
        shouldResolvePureObjects: argv.p,
        shouldResolveDiscriminator: argv.c,
        shouldResolveNullableTypes: argv.n,
      }

      if (specPath.match(/.*composite.*/ig) !== null) {
        await validate.resolveCompositeSpec(specPath, argv.d, vOptions)
      } else {
        await validate.resolveSpec(specPath, argv.d, vOptions)
      }
    }
  )
}
