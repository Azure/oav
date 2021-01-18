// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

// Sample standalone script to call live validator.
import { LiveValidator } from "../lib/liveValidation/liveValidator";

const options = {
  directory: `${__dirname}/../../test/liveValidation/swaggers/`,
  swaggerPathsPattern: [
    "specification\\mediaservices\\resource-manager\\Microsoft.Media\\2018-07-01\\*.json",
  ],
  git: {
    shouldClone: false,
  },
};
const validator = new LiveValidator(options);

// eslint-disable-next-line @typescript-eslint/no-floating-promises
validator.initialize().then(() => {
  const reqRes = require(`${__dirname}/../../test/liveValidation/payloads/oneOfMissing_input.json`);
  const result = validator.validateLiveRequestResponse(reqRes);
  // tslint:disable-next-line:no-console
  console.log(`${result}`);
});
