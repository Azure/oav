// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { StringMap } from "@ts-common/string-map"

export const xmsParameterizedHost = "x-ms-parameterized-host"

export const xmsExamples = "x-ms-examples"

export const xmsSkipUrlEncoding = "x-ms-skip-url-encoding"

export const exampleInSpec = "example-in-spec"

export const Errors = "Errors"

export const Warnings = "Warnings"

export const knownTitleToResourceProviders: StringMap<string> = {
  ResourceManagementClient: "Microsoft.Resources"
}

export const EnvironmentVariables = {
  ClientId: "CLIENT_ID",
  Domain: "DOMAIN",
  ApplicationSecret: "APPLICATION_SECRET",
  AzureSubscriptionId: "AZURE_SUBSCRIPTION_ID",
  AzureLocation: "AZURE_LOCATION",
  AzureResourcegroup: "AZURE_RESOURCE_GROUP"
}

export const unknownResourceProvider = "microsoft.unknown"
export const unknownApiVersion = "unknown-api-version"
