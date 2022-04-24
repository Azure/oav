// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */
import * as yargs from "yargs";

export const command = "generate-api-scenario <command>";
export const describe = "Generate api scenario.";

export function builder() {
  return yargs.commandDir("generate-api-scenario");
}

export async function handler() {}
