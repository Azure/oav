// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { inject, injectable } from "inversify";
import { cloneDeep } from "@azure-tools/openapi-tools-common";
import { TYPES } from "../inversifyUtils";
import { setDefaultOpts } from "./../swagger/loader";

type MaskFunction = (content?: string) => string;
export interface DataMaskerOption {
  maskValue: MaskFunction;
}

export const defaultMaskValue = (_content?: string): string => {
  return "<masked>";
};

@injectable()
export class DataMasker {
  public maskKeys: string[] = [
    "client_secret",
    "password",
    "connectionString",
    "accessToken",
    "token",
    "sas",
  ];
  public maskValues: string[] = [];
  public maskValuePatterns: RegExp[] = [
    new RegExp(/Bearer\s[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?/),
  ];
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(@inject(TYPES.opts) private opts: DataMaskerOption) {
    setDefaultOpts(this.opts, { maskValue: defaultMaskValue });
  }

  public addMaskedValues(secrets: string[]) {
    this.maskValues = this.maskValues.concat(secrets);
  }

  public addMaskedKeys(secretKeys: string[]) {
    this.maskKeys = this.maskKeys.concat(secretKeys);
  }

  public addMaskedValuePatterns(pattern: RegExp[]) {
    this.maskValuePatterns = this.maskValuePatterns.concat(pattern);
  }

  public jsonStringify(obj: any): string {
    if (typeof obj === "string") {
      return this.maskString(obj);
    }
    return this.maskString(JSON.stringify(this.maskObject(obj), null, 2));
  }

  public jsonParse(content: string): any {
    try {
      return JSON.parse(this.maskString(content));
    } catch (err) {
      return undefined;
    }
  }

  public maskObject(obj: any, addMaskedValue = false): any {
    const mask = (obj: any) => {
      for (const k in obj) {
        if (obj.hasOwnProperty(k) && obj[k] !== null) {
          if (obj[k].constructor === Object) {
            mask(obj[k]);
          } else if (obj[k].constructor === Array) {
            mask(obj[k]);
          } else if (typeof obj[k] === "string") {
            if (this.maybeSecretKey(k)) {
              if (addMaskedValue) {
                this.maskValues.push(obj[k]);
              }
              obj[k] = this.opts.maskValue(obj[k]);
            }
            if (this.maybeSecretValue(obj[k])) {
              if (addMaskedValue) {
                this.maskValues.push(obj[k]);
              }
              obj[k] = this.opts.maskValue(obj[k]);
            }
          }
        }
      }
    };
    const ret = cloneDeep(obj);
    mask(ret);
    return ret;
  }

  public maybeSecretKey(key: any): boolean {
    if (typeof key !== "string") {
      return false;
    }
    return (
      this.maskKeys.some((it) => key.toLowerCase().includes(it)) ||
      this.maskValuePatterns.some((it) => it.test(key))
    );
  }

  public maybeSecretValue(value: any): boolean {
    // TODO: implement secret pattern value match function here. A new field: valuePatterns
    // https://dev.azure.com/msazure/One/_git/SecEng-CredScan-SDK?path=%2Fsrc%2FKustoThreatAnalyzer%2FKustoThreatAnalyzer.Core%2FPrefilter%2FPrefilterCore.txt&version=GBCredScanClient_Integration
    if (typeof value !== "string") {
      return false;
    }
    return this.maskValues.some((it) => value === it);
  }

  public maskString(content: string): any {
    let ret = content;
    for (const it of this.maskValues) {
      ret = replaceAll(ret, it, this.opts.maskValue(it));
    }

    for (const it of this.maskValuePatterns) {
      ret = replaceAll(ret, it, this.opts.maskValue());
    }
    return ret;
  }
}

/* ref: https://stackoverflow.com/questions/1144783/how-to-replace-all-occurrences-of-a-string-in-javascript
 * doc: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
 */
function escapeRegExp(string: string) {
  return string.replace(/[.*+\-?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export function replaceAll(str: string, find: string | RegExp, replace: string): string {
  if (typeof find === "string") {
    return str.replace(new RegExp(escapeRegExp(find), "g"), replace);
  } else {
    return str.replace(new RegExp(find, "g"), replace);
  }
}
