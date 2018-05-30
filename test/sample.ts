// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

//Sample standalone script to call live validator.
import assert = require('assert')
import path = require('path')
import os = require('os')
import { LiveValidator } from '../lib/validators/liveValidator.js'
import { Constants } from '../lib/util/constants'

let options = {
  "directory": "./test/swaggers/arm-storage"
}
let validator = new LiveValidator(options)
validator.initialize().then(function () {
  let reqRes = require(__dirname + '/liveValidation/swaggers/specification/storage/resource-manager/Microsoft.Storage/2016-01-01/live/StorageAccounts_CheckNameAvailability.json')
  let requestResponseObj = {
    liveRequest: reqRes.request,
    liveResponse: reqRes.response
  }
  validator.validateLiveRequestResponse(requestResponseObj)
})