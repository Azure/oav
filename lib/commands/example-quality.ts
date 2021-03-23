// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as yargs from "yargs";

import { ExampleQualityValidator } from "../exampleQualityValidator/exampleQualityValidator";
import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { log } from "../util/logging";

export const command = "example-quality <spec-path>";

export const describe = "Performs validation of x-ms-examples and examples present in the spec.";

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    log.debug(argv.toString());
    const specPath = argv.specPath;
    const validator = ExampleQualityValidator.create({
      swaggerFilePaths: [specPath],
    });
    const res = await validator.validateSwaggerExamples();
    console.log(JSON.stringify(res, null, 2));
    return 0;
  });
}
