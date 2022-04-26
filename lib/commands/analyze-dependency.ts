// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as path from "path";
import * as yargs from "yargs";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { SwaggerAnalyzer } from "../apiScenario/swaggerAnalyzer";
import { getInputFiles } from "../util/utils";

export const command = "analyze-dependency";

export const describe = "analyze swagger resource type dependency.";

export const builder: yargs.CommandBuilder = {
  tag: {
    describe: "the readme tag name.",
    string: true,
  },
  swagger: {
    describe: "swagger file to analyze. this option is to analyze single swagger file dependency.",
    string: true,
  },
  readme: {
    describe: "path to readme.md file.",
    string: true,
  },
  filterTopLevelResource: {
    alias: "t",
    describe: "filter top level resource",
    boolean: true,
    default: false,
  },
  filterNoExternalDependencyResource: {
    alias: "n",
    describe: "filter no external dependency resource",
    boolean: true,
    default: false,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    let swaggerFilePaths: string[] = [];
    if (argv.readme !== undefined) {
      const readmeMd: string = argv.readme;
      swaggerFilePaths = await getInputFiles(readmeMd, argv.tag);
    }
    if (argv.swagger !== undefined) {
      swaggerFilePaths.push(path.resolve(argv.swagger));
    }
    const analyzer = SwaggerAnalyzer.create({
      swaggerFilePaths: swaggerFilePaths,
      filerTopLevelResourceType: argv.filterTopLevelResource,
      noExternalDependencyResourceType: argv.filterNoExternalDependencyResource,
    });
    await analyzer.initialize();
    const res = await analyzer.analyzeDependency();
    console.log(JSON.stringify(res, null, 2));
    return 0;
  });
}
