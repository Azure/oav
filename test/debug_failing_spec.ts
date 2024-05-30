// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* tslint:disable:no-console max-line-length*/

import * as validate from "../lib/validate";

import { clonePR } from "./utilities.helpers";

const prNumber: number = 27067;
const prRepo: string = "azure/azure-rest-api-specs";
const specRelPath = `specification/storage/resource-manager/Microsoft.Storage/stable/2023-01-01/blob.json`;

jest.setTimeout(1000000); // Set the timeout in milliseconds

describe("Semantic Validation", () => {
  it("Debug an individual spec failing semantic validation.", async () => {
    const repoPath = clonePR(`https://github.com/${prRepo}.git`, prNumber);
    const result = await validate.validateSpec(`${repoPath}/${specRelPath}`, undefined);
    console.log(result);
  });
});
