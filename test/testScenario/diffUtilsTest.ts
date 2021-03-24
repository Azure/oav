/* eslint-disable prettier/prettier */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { getJsonPatchDiff, jsonPatchApply } from "../../lib/testScenario/diffUtils";

const fixtures = {
  "0_sameSimple": {
    from: [0, 1, 2],
    to: [0, 1, 2],
  },
  "10_diffDeepObj": {
    from: {
      a: {
        b: {
          c: 1,
          f: 6,
          g: "Some Very Very Long Text That Didn't Change Oh My God",
        },
        d: 2,
      },
    },
    to: {
      a: {
        b: {
          g: "Some Very Very Long Text That Didn't Change Oh My God",
          c: 3,
          e: 5,
        },
        d: 4,
      },
    },
  },
  "11_useReplace": {
    from: {
      a: {
        b: { c: 1, f: 6 },
        d: 2,
      },
    },
    to: {
      a: {
        b: { c: 3, e: 5 },
        d: 4,
      },
    },
  },
  "20_arrayIdxSimple": {
    from: [{ id: 2, val: "from", otherKey: "VeryVeryLong" }],
    to: [{ id: 1 }, { id: 2, val: "to", otherKey: "VeryVeryLong" }],
  },
} as const;

describe("DiffUtils", () => {
  it("should diff and apply patch", () => {
    for (const testName of (Object.keys(fixtures) as unknown) as Array<keyof typeof fixtures>) {
      // if (testName !== "20_arrayIdxSimple") { continue; }
      const fixture = fixtures[testName];
      const diff = getJsonPatchDiff(fixture.from, fixture.to, { minimizeDiff: true });
      expect(diff).toMatchSnapshot(testName);

      const result = jsonPatchApply(fixture.from, diff);
      expect(result).toEqual(fixture.to);
    }
  });
});
