// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

// Sample standalone script to call live validator.
import { LiveValidator } from "../lib/validators/liveValidator"

const options = {
  directory: "C:\\github.com\\Azure\\azure-rest-api-specs",
  swaggerPathsPattern:
    "specification\\batch\\resource-manager\\Microsoft.Batch\\stable\\2017-01-01\\" +
    "BatchManagement.json"
}
const validator = new LiveValidator(options)

// tslint:disable-next-line:no-floating-promises
validator.initialize().then(() => {
  const reqRes = require(__dirname +
    "/liveValidation/swaggers/specification/storage/resource-manager/Microsoft.Storage/" +
    "2016-01-01/live/StorageAccounts_CheckNameAvailability.json")
  const requestResponseObj = {
    liveRequest: reqRes.request,
    liveResponse: reqRes.response
  }
  validator.validateLiveRequestResponse(requestResponseObj)
})
