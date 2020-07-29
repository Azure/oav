// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { FilePosition } from "@ts-common/source-map";
import { StringMap } from "@ts-common/string-map";

export interface CommonError {
  readonly code?: string;
  readonly id?: string;
  readonly message?: string;
  readonly innerErrors?: CommonError[];
  path?: string | string[];
  readonly inner?: CommonError[];
  errors?: CommonError[];
  in?: unknown;
  name?: string;
  params?: unknown[];
  jsonUrl?: string;
  jsonPosition?: FilePosition;
  position?: FilePosition;
  url?: string;
  title?: string;
  directives?: StringMap<unknown>;
}
