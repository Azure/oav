import * as yargs from "yargs";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { log } from "../util/logging";
import * as validate from "../validate";

export const command = "validate-traffic <traffic-path> <spec-path>";
export const describe = "Validate the spec file based on the traffic payload";

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    log.debug(argv.toString())
    const specPath = argv.specPath;
    const trafficPath = argv.trafficPath;
    const vOptions: validate.Options = {
      consoleLogLevel: argv.logLevel,
      logFilepath: argv.f,
      pretty: argv.p
    }
    const errors = await validate.validateTrafficInSpec(specPath, trafficPath, vOptions);
    return errors.length > 0 ? 1 : 0;
  })
}