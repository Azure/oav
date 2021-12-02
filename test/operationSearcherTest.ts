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

    specPath = "specification/cosmos-db/data-plane/Microsoft/preview/2019-02-02/table.json";
    provider = getProviderFromSpecPath(specPath);
    expect(provider).toEqual({ provider: "Microsoft", type: "data-plane" });

    specPath =
      "specification/cognitiveservices/data-plane/TextAnalytics/preview/v3.2-preview.1/TextAnalytics.json";
    provider = getProviderFromSpecPath(specPath);
    expect(provider).toEqual({ provider: "TextAnalytics", type: "data-plane" });

    specPath =
      "/specification/purview/data-plane/Azure.Analytics.Purview.Account/preview/2019-11-01-preview/account.json";
    provider = getProviderFromSpecPath(specPath);
    expect(provider).toEqual({ provider: "Azure.Analytics.Purview.Account", type: "data-plane" });

    specPath =
      "specification/search/data-plane/Microsoft.Azure.Search.Service/preview/2015-02-28-preview/searchservice.json";
    provider = getProviderFromSpecPath(specPath);
    expect(provider).toEqual({ provider: "Microsoft.Azure.Search.Service", type: "data-plane" });
  });
});
