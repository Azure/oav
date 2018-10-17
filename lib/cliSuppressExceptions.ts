import { log } from './util/logging';

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

export const cliSuppressExceptions = async (f: () => Promise<void>): Promise<void> => {
  try {
    await f()
  } catch (err) {
    const message = `fatal error: ${JSON.stringify(err)}`
    log.error(message)
    // tslint:disable-next-line:no-console
    console.error(message)
    process.exitCode = 1
  }
}
