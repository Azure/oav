// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

export interface Error {
  readonly code: string
  readonly id: string
  readonly message: string
  readonly innerErrors: Error[]
  readonly path?: string
  readonly inner?: Error[]
}
