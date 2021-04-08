// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as path from "path";
import * as yargs from "yargs";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { getAutorestConfig } from "../util/getAutorestConfig";
import { SwaggerAnalyzer } from "../testScenario/swaggerAnalyzer";

export const command = "analyze-dependency";

export const describe = "analyze swagger resource type dependency.";

export const builder: yargs.CommandBuilder = {
  tag: {
    describe: "the readme tag name.",
    string: true,
  },
  readme: {
    describe: "path to readme.md file",
    string: true,
    demandOption: true,
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
    const readmeMd: string = argv.readme;

    const autorestConfig = await getAutorestConfig(argv, readmeMd);
    const fileRoot = path.dirname(readmeMd);
    const swaggerFilePaths: string[] = autorestConfig["input-file"].map((it: string) =>
      path.resolve(fileRoot, it)
    );
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
