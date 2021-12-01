// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { getProviderFromSpecPath } from "../lib/liveValidation/operationSearcher";

describe("Get resource provider from spec path", () => {
  it("should return the correct provider", () => {
    let specPath =
      "specification/apimanagement/resource-manager/Microsoft.ApiManagement/preview/2018-01-01/apimanagement.json";
    let provider = getProviderFromSpecPath(specPath);
    expect(provider).toEqual({ provider: "Microsoft.ApiManagement", type: "resource-manager" });

    specPath = "specification/cosmos-db/data-plane/Microsoft.Tables/preview/2019-02-02/table.json";
    provider = getProviderFromSpecPath(specPath);
    expect(provider).toEqual({ provider: "Microsoft.Tables", type: "data-plane" });
  });
});
