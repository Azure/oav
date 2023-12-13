// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* tslint:disable:no-console max-line-length*/

import assert from "assert";
import * as validate from "../lib/validate";

import { repoPath, clonePR } from "./testUtilities";

const prNumber: number = 27067;
const prRepo: string = "azure/azure-rest-api-specs";
const specPath = `${repoPath}/specification/storage/resource-manager/Microsoft.Storage/stable/2023-01-01/blob.json`;

jest.setTimeout(1000000); // Set the timeout in milliseconds

describe("Semantic Validation", () => {
  it("Debug an individual spec failing semantic validation.", async () => {
    clonePR(`https://github.com/${prRepo}.git`, prNumber)
    
    const result = await validate.validateSpec(specPath, undefined);

    assert(
      result.validityStatus === true,
      `swagger "${specPath}" contains unexpected semantic validation errors.`
    );
  });
});
