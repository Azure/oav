// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import assert = require('assert')
import * as utils from '../lib/util/utils.js'

describe('Utility functions', function () {
  describe('Get Provider', function () {
    it('should throw on empty', function () {
      assert.throws(() => {
        utils.getProvider('')
      })
    })
    it('should throw null', function () {
      assert.throws(() => {
        utils.getProvider(null)
      })
    })
    it('should throw undefined', function () {
      assert.throws(() => {
        utils.getProvider()
      })
    })
    it('should return Microsoft.Resources', function () {
      let path =
        "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Resources/{parentResourcePath}/{resourceType}/{resourceName}"
      let provider = utils.getProvider(path)
      assert.equal(provider, 'Microsoft.Resources')
    })
    it('should return undefined', function () {
      let path = "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/"
      let provider = utils.getProvider(path)
      assert.equal(provider, undefined)
    })
    it('should return Microsoft.Authorization', function () {
      let path = "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Resources/{parentResourcePath}/{resourceType}/{resourceName}/providers/Microsoft.Authorization/roleAssignments"
      let provider = utils.getProvider(path)
      assert.equal(provider, 'Microsoft.Authorization')
    })
  })
})
