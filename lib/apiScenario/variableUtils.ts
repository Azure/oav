import { escapeRegExp } from "lodash";

export const replaceAllInObject = (
  obj: any,
  toMatch: string[],
  matchReplace: { [match: string]: string }
) => {
  if (toMatch.length === 0) {
    return;
  }
  const matchRegExp = new RegExp(toMatch.map(escapeRegExp).join("|"), "gi");

  const replaceString = (input: string) => {
    if (typeof input !== "string") {
      return input;
    }

    const matches = input.matchAll(matchRegExp);
    let result = input;
    let offset = 0;
    for (const match of matches) {
      const matchStr = match[0].toLowerCase();
      const toReplace = matchReplace[matchStr];
      const index = match.index! + offset;
      result = result.substr(0, index) + toReplace + result.substr(index + matchStr.length);

      offset = offset + toReplace.length - matchStr.length;
    }

    return result;
  };

  const traverseObject = (obj: any) => {
    if (obj === null || obj === undefined) {
      return;
    }
    if (Array.isArray(obj)) {
      for (let idx = 0; idx < obj.length; ++idx) {
        if (typeof obj[idx] === "string") {
          obj[idx] = replaceString(obj[idx]);
        } else {
          traverseObject(obj[idx]);
        }
      }
    } else if (typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === "string") {
          obj[key] = replaceString(obj[key]);
        } else {
          traverseObject(obj[key]);
        }
      }
    }
  };
  traverseObject(obj);
};
