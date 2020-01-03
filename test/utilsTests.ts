// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import assert from "assert"

import * as utils from "../lib/util/utils"

describe("Utility functions", () => {
  describe("Get Provider", () => {
    it("should throw on empty", () => {
      assert.throws(() => {
        utils.getProvider("")
      })
    })
    it("should throw null", () => {
      assert.throws(() => {
        utils.getProvider(null)
      })
    })
    it("should throw undefined", () => {
      assert.throws(() => {
        utils.getProvider()
      })
    })
    it("should return Microsoft.Resources", () => {
      const path =
        "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/" +
        "Microsoft.Resources/{parentResourcePath}/{resourceType}/{resourceName}"
      const provider = utils.getProvider(path)
      assert.strictEqual(provider, "Microsoft.Resources")
    })
    it("should return undefined", () => {
      const path = "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/"
      const provider = utils.getProvider(path)
      assert.strictEqual(provider, undefined)
    })
    it("should return Microsoft.Authorization", () => {
      const path =
        "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/" +
        "Microsoft.Resources/{parentResourcePath}/{resourceType}/{resourceName}/providers/" +
        "Microsoft.Authorization/roleAssignments"
      const provider = utils.getProvider(path)
      assert.strictEqual(provider, "Microsoft.Authorization")
    })
  })

  describe("Get provider by swagger file name", () => {
    it("should return undefined", () => {
      assert.equal(utils.getProviderBySwaggerFileName(""), undefined)
      assert.equal(
        utils.getProviderBySwaggerFileName("/specs/data-plane/Microsoft.Storage/swagger.json"),
        undefined
      )
    })

    it("should return resource provider", () => {
      assert.equal(
        utils.getProviderBySwaggerFileName(
          "specification/apimanagement/resource-manager/Microsoft.ApiManagement/preview/2018-01-01/apimwriteonly.json"
        ),
        "Microsoft.ApiManagement"
      )
    })
  })
})
