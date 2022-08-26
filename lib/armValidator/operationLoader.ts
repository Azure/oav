import { injectable } from "inversify";
import { readFile as vfsReadFile } from "@azure-tools/openapi-tools-common";
import { JSONPath } from "jsonpath-plus";
import {
  SwaggerSpec,
  Operation as SwaggerOperation,
  Path,
  LowerHttpMethods,
} from "../swagger/swaggerTypes";
import { xmsExamples } from "../util/constants";
import { traverseSwagger } from "../transform/traverseSwagger";

export enum CompareType {
  isConsistent,
  isMissing,
}

type Specs = any[];
type Attr = Map<string, string[]>;
//readOnly: [RestorePointCollection.properties.provisioningState]
//'parameters/schema/properties/properties/allOf/0/allOf/0/properties/isCurrent'
type Operation = Map<string, Attr>;
//RestorePointCollections_CreateOrUpdate
type ApiVersion = Map<string, Operation | Specs>;
//2021-11-01
type Provider = Map<string, ApiVersion>;

var pointer = require("json-pointer");

@injectable()
export class OperationLoader {
  //Microsoft.Compute
  //->2021-11-01
  //-->RestorePointCollections_CreateOrUpdate
  //--->readOnly
  //---->[RestorePointCollection.properties.provisioningState]
  public readonly cache = new Map<string, Provider>();
  private ruleMap = new Map<string, string>([
    ["readOnly", "$..[?(@.readOnly)]~"],
    ["secret", "$..[?(@['x-ms-secret'])]~"],
    ["default", "$..[?(@['default'])]~"],
    ["mutability", "$..[?(@['x-ms-mutability'])]~"],
  ]);

  private statusCodeReg = new RegExp("^/([0-9]*)", "i");

  public constructor(ruleMap?: Map<string, string>) {
    if (ruleMap !== undefined) {
      ruleMap.forEach((value: string, key: string) => {
        this.ruleMap.set(key, value);
      });
    }
  }

  public async init(spec: SwaggerSpec, isLazyBuild?: boolean) {
    const startTime = Date.now();
    const providerName = spec._providerNamespace!.toLowerCase();
    //TODO: use swaggerLoader to load swagger
    let elapsedTime = Date.now();
    const apiVersion = spec.info.version.toLowerCase();

    let operations: SwaggerOperation[] = [];
    traverseSwagger(spec, {
      onOperation: (operation: SwaggerOperation, _path: Path, _method: LowerHttpMethods) => {
        operations.push(operation);
      },
    });
    let apiVersions = this.cache.get(providerName);
    if (apiVersions === undefined) {
      apiVersions = new Map();
      this.cache.set(providerName!, apiVersions);
    }
    let allOperations = apiVersions.get(apiVersion);
    if (allOperations === undefined) {
      allOperations = new Map();
      apiVersions.set(apiVersion, allOperations);
    }
    let items = allOperations.get("spec") as Specs;
    if (items === undefined) {
      items = [];
      allOperations.set("spec", items);
    }
    items = allOperations.get("spec") as Specs;
    items = items.concat(operations);
    allOperations.set("spec", items);
    if (isLazyBuild) {
      return;
    }
    for (const operation of operations) {
      const operationId = operation["operationId"]!;
      if (typeof operationId === "object") {
        continue;
      }
      const litOp = {
        parameters: operation.parameters,
        responses: operation.responses,
        operationId: operation.operationId,
      };
      for (const rule of this.ruleMap) {
        const value = rule[1];
        const key = rule[0];
        const attrs = this.getAllTargetKey(value, litOp);
        let apiVersions = this.cache.get(providerName);
        if (apiVersions === undefined) {
          apiVersions = new Map();
          this.cache.set(providerName!, apiVersions);
        }
        let allOperations = apiVersions.get(apiVersion);
        if (allOperations === undefined) {
          allOperations = new Map();
          apiVersions.set(apiVersion, allOperations);
        }
        let allRules = allOperations.get(operationId) as Operation;
        if (allRules === undefined) {
          allRules = new Map();
          allOperations.set(operationId, allRules);
        }
        let allAttrs = allRules.get(key);
        if (allAttrs === undefined) {
          allAttrs = new Map();
          allRules.set(key, allAttrs);
        }
        allAttrs = allRules.get(key);
        for (const attr of attrs) {
          const attrPath = this.getAttrPath(operation as any, attr.pointer);
          if (attrPath !== undefined) {
            let xmsValue: string[] = [];
            if (key === "mutability") {
              xmsValue = attr.parent[attr.value]["x-ms-mutability"] as string[];
            }
            allAttrs?.set(attrPath, xmsValue);
          }
        }
      }
    }
    elapsedTime = Date.now() - startTime;
    console.log(`Time ${elapsedTime} to process ${spec._filePath}`);
  }

  public attrChecker(
    jsonPath: string,
    providerName: string,
    apiVersion: string,
    operationId: string,
    statusCode: string,
    inParam: boolean,
    xmsPath: string,
    xmsValues?: string[]
  ) {
    const attrs = this.getAttrs(providerName, apiVersion, operationId, xmsPath, xmsValues);
    if (attrs === undefined || attrs.length <= 0) {
      return false;
    }
    const resRegex = new RegExp(jsonPath, "g");
    for (const attr of attrs) {
      if (resRegex.test(attr)) {
        const status = attr.match(this.statusCodeReg);
        if (inParam && status === null) {
          return true;
        }
        if (!inParam && status !== null && status[1] === statusCode) {
          return true;
        }
      }
    }
    return false;
  }

  public getAttrs(
    providerName: string,
    apiVersion: string,
    inputOperation: string,
    xmsPath: string,
    xmsValues?: string[]
  ) {
    let res: string[] = [];
    let items = this.cache.get(providerName)?.get(apiVersion)?.get(inputOperation) as Operation;
    if (items !== undefined) {
      const attrs = items.get(xmsPath);
      if (attrs !== undefined) {
        if (xmsPath === "mutability" && xmsValues !== undefined) {
          for (const attr of attrs) {
            if (isSubset(attr[1], xmsValues)) {
              res.push(attr[0]);
            }
          }
        } else {
          for (const attr of attrs) {
            res.push(attr[0]);
          }
        }
      }
      return res;
    } else {
      const allOps = this.cache.get(providerName)?.get(apiVersion)?.get("spec");
      if (allOps === undefined) {
        console.log(`Spec cache should not be empty ${inputOperation}`);
        return res;
      }
      const startTime = Date.now();
      for (const operation of allOps) {
        const operationId = operation["operationId"];
        const litOp = {
          parameters: operation.parameters,
          responses: operation.responses,
          operationId: operation.operationId,
        };
        if (typeof operationId === "object") {
          continue;
        }
        if (typeof operationId === "string" && operationId === inputOperation) {
          for (const rule of this.ruleMap) {
            const value = rule[1];
            const key = rule[0];
            const attrs = this.getAllTargetKey(value, litOp);
            let apiVersions = this.cache.get(providerName);
            if (apiVersions === undefined) {
              apiVersions = new Map();
              this.cache.set(providerName!, apiVersions);
            }
            let allOperations = apiVersions.get(apiVersion);
            if (allOperations === undefined) {
              allOperations = new Map();
              apiVersions.set(apiVersion, allOperations);
            }
            let allRules = allOperations.get(operationId) as Operation;
            if (allRules === undefined) {
              allRules = new Map();
              allOperations.set(operationId, allRules);
            }
            let allAttrs = allRules.get(key);
            if (allAttrs === undefined) {
              allAttrs = new Map();
              allRules.set(key, allAttrs);
            }
            allAttrs = allRules.get(key);
            for (const attr of attrs) {
              if (attr.pointer === "/responses") {
                continue;
              }
              const attrPath = this.getAttrPath(operation as any, attr.pointer);
              if (attrPath === undefined) {
                continue;
              }
              let xmsValue: string[] = [];
              if (key === "mutability") {
                xmsValue = attr.parent[attr.value]["x-ms-mutability"] as string[];
              }
              allAttrs?.set(attrPath, xmsValue);
            }
          }
          break;
        }
      }
      const duration = Date.now() - startTime;
      console.log(`Time ${duration} to init ${inputOperation}`);
    }
    items = this.cache.get(providerName)?.get(apiVersion)?.get(inputOperation) as Operation;
    if (items !== undefined) {
      const attrs = items.get(xmsPath);
      if (attrs !== undefined) {
        if (xmsPath === "mutability" && xmsValues !== undefined) {
          for (const attr of attrs) {
            if (isSubset(attr[1], xmsValues)) {
              res.push(attr[0]);
            }
          }
        } else {
          for (const attr of attrs) {
            res.push(attr[0]);
          }
        }
      }
    }
    return res;
  }

  private removeProperty(object: any) {
    if (typeof object === "object" && object !== null) {
      const obj = object as any;
      if (typeof obj.description === "string") {
        delete obj.description;
      }
      if (obj[xmsExamples] !== undefined) {
        delete obj[xmsExamples];
      }
      Object.keys(object).forEach((o) => {
        this.removeProperty(object[o]);
      });
    }
  }

  private getAllTargetKey(allXmsPath: string, swagger: any) {
    const ret = JSONPath({
      path: allXmsPath,
      json: swagger,
      resultType: "all",
    });
    return ret;
  }

  private getAttrPath(obj: any, path: string) {
    //'/parameters/3/schema/properties/properties/properties/contentValue';
    const regex = /(\/parameters\/[\d])/g;
    const found = path.match(regex);
    const resRegex = new RegExp("^/responses", "g");
    let name, attrPath;
    if (found !== null) {
      const reObj = pointer.get(obj, found[0]);
      name = reObj.name;
      attrPath = path.replace(regex, name);
    } else if (resRegex.test(path)) {
      attrPath = path.replace(resRegex, "");
    } else {
      console.log(`Check invalid path: ${JSON.stringify(obj)} ${path}`);
    }
    return attrPath;
  }
}

export function isExample(path: string) {
  return path.split(/\\|\//g).includes("examples");
}

export async function loadSingleFile(filePath: string) {
  const fileString = await vfsReadFile(filePath);
  return JSON.parse(fileString);
}

export function isSubset(ele: string | string[], set: string[]) {
  if (typeof ele === "string") {
    if (set.includes(ele)) {
      return true;
    }
    return false;
  }
  for (const e of ele) {
    if (!set.includes(e)) {
      return false;
    }
  }
  return true;
}
