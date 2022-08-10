import { injectable } from "inversify";
import { Json, readFile as vfsReadFile } from "@azure-tools/openapi-tools-common";
import { JSONPath } from "jsonpath-plus";
import $RefParser, { FileInfo } from "@apidevtools/json-schema-ref-parser";
import { FileLoader, FileLoaderOption } from "../swagger/fileLoader";
import { SwaggerSpec, Operation as SwaggerOperation } from "../swagger/swaggerTypes";
import { xmsExamples } from "../util/constants";

export interface OperationLoaderOption extends FileLoaderOption {
  //Rules will be applied to swagger: readonly: readOnly=true
  supportYaml?: boolean;
  useJsonParser?: boolean;
}

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
  private fileLoader: FileLoader;

  public constructor(fileLoader: FileLoader, ruleMap?: Map<string, string>) {
    if (ruleMap !== undefined) {
      ruleMap.forEach((value: string, key: string) => {
        this.ruleMap.set(key, value);
      });
    }
    this.fileLoader = fileLoader;
  }

  public async init(inputFilePaths: string[], isLazyBuild?: boolean) {
    for (const inputFilePath of inputFilePaths) {
      const startTime = Date.now();
      const providerName = this.parseProviderName(inputFilePath)?.toLowerCase();
      if (providerName === undefined) {
        console.log(`Illegal file path, unable to extract provider name ${inputFilePath}`);
        return;
      }
      const spec = (await this.load(inputFilePath)) as SwaggerSpec;
      let elapsedTime = Date.now();
      const apiVersion = JSON.parse(JSON.stringify(spec))["info"]["version"].toLowerCase();

      //const values = Object.values(spec.paths).map((a) => Object.values(a).filter((b) => (<SwaggerOperation>b).operationId !== undefined));
      let operations: SwaggerOperation[] = [];
      const values = Object.values(spec.paths);
      for (const value of values) {
        const ops = Object.values(value).filter(
          (b) => (b as SwaggerOperation).operationId !== undefined
        ) as SwaggerOperation[];
        operations = operations.concat(ops);
      }
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
      //const operations = await this.getAllTargetKey("$..[?(@.operationId)]~", spec);
      for (const operation of operations) {
        //const path = op.path;
        //const parent = op.parent;
        //const operation = parent[op.value];
        const operationId = operation["operationId"]!;
        if (typeof operationId === "object") {
          continue;
        }
        //console.log(`operationId: ${operationId}, path: ${path}`);
        for (const rule of this.ruleMap) {
          const value = rule[1];
          const key = rule[0];
          const attrs = this.getAllTargetKey(value, operation);
          //console.log(`${key}: ${attrs.length}`);
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
            //TODO: parameter as a list, get the name of the element
            const attrPath = this.getAttrPath(operation as any, attr.pointer);
            if (attrPath !== undefined) {
              let xmsValue: string[] = [];
              if (key === "mutability") {
                xmsValue = attr.parent[attr.value]["x-ms-mutability"] as string[];
              }
              allAttrs?.set(attrPath, xmsValue);
            }
            //console.log(`Get attrPath ${attrPath}`);
          }
        }
      }
      elapsedTime = Date.now() - startTime;
      console.log(`Time ${elapsedTime} to process ${inputFilePath}`);
    }
    console.log("Finish building cache.");
  }

  private async load(inputFilePath: string): Promise<Json> {
    //Read content from swagger file and
    let fileContent = JSON.parse(await this.fileLoader.load(inputFilePath));
    if (typeof fileContent !== "object" || fileContent === null) {
      return {};
    }

    //remove unnecessary properties
    this.removeProperty(fileContent);
    //console.log(JSON.stringify(fileContent));

    //resolve all refs using lib: https://github.com/APIDevTools/json-schema-ref-parser
    const resolveOption: $RefParser.Options = {
      resolve: {
        file: {
          canRead: true,
          read(file: FileInfo) {
            if (isExample(file.url)) {
              return {};
            }
            return loadSingleFile(file.url);
          },
        },
      },
    };
    try {
      const parser = new $RefParser();
      fileContent = await parser.dereference(inputFilePath, fileContent, resolveOption);
      //console.log(`Deferenced: ${JSON.stringify(fileContent.definitions!.ApiCollection)}`);
    } catch (err) {
      console.error(err);
      return {};
    }

    return fileContent;
  }

  public attrChecker(
    jsonPath: string,
    providerName: string,
    apiVersion: string,
    operationId: string,
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
        return true;
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
    //const attrs = this.cache.get(providerName)?.get(apiVersion)?.get(inputOperation)?.get(xmsPath);
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
        //const path = op.path;
        //const parent = op.parent;
        //const operation = parent[op.value];
        const operationId = operation["operationId"];
        if (typeof operationId === "object") {
          continue;
        }
        if (typeof operationId === "string" && operationId === inputOperation) {
          //console.log(`operationId: ${operationId}, path: ${path}`);
          for (const rule of this.ruleMap) {
            const value = rule[1];
            const key = rule[0];
            const attrs = this.getAllTargetKey(value, operation);
            //console.log(`${key}: ${attrs.length}`);
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
              //TODO: parameter as a list, get the name of the element
              const attrPath = this.getAttrPath(operation as any, attr.pointer);
              if (attrPath === undefined) {
                continue;
              }
              let xmsValue: string[] = [];
              if (key === "mutability") {
                xmsValue = attr.parent[attr.value]["x-ms-mutability"] as string[];
              }
              allAttrs?.set(attrPath, xmsValue);
              //console.log(`Get attrPath ${attrPath}`);
            }
          }
        }
      }
      const duration = Date.now() - startTime;
      console.log(`Time ${duration} to init ${inputOperation}`);
    }
    items = this.cache.get(providerName)?.get(apiVersion)?.get(inputOperation) as Operation;
    //const attrs = this.cache.get(providerName)?.get(apiVersion)?.get(inputOperation)?.get(xmsPath);
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

  /*private parseFileContent(filePath: string, fileString: string): any {
    if (this.opts.supportYaml && (filePath.endsWith(".yaml") || filePath.endsWith(".yml"))) {
      return parseYaml(fileString, {
        filename: filePath,
        json: true,
      });
    }

    return this.opts.useJsonParser ? parseJson(filePath, fileString) : JSON.parse(fileString);

    // throw new Error(`Unknown file format while loading file ${cache.filePath}`);
  }*/

  private parseProviderName(filePath: string) {
    const rpReg = new RegExp(`\/resource-manager\/(.*?)\/`, "i");
    //let testStr = "https://github.com/Azure/azure-rest-api-specs/blob/main/specification/securityinsights/resource-manager/Microsoft.SecurityInsights/preview/2019-01-01-preview/Aggregations.json"
    const result = filePath.match(rpReg);
    if (result) {
      return result[1];
    }
    return;
  }

  private removeProperty(object: any) {
    if (typeof object === "object" && object !== null) {
      const obj = object as any;
      if (typeof obj.description === "string") {
        delete obj.description;
      }
      if (obj[xmsExamples] !== undefined) {
        //console.log(`Before removal: ${JSON.stringify(obj)}`);
        delete obj[xmsExamples];
        //console.log(`After removal: ${JSON.stringify(obj)}`);
      }
      Object.keys(object).forEach((o) => {
        this.removeProperty(object[o]);
      });
    }
  }

  private getAllTargetKey(allXmsPath: string, swagger: any) {
    //const startTime = Date.now();
    //console.log(`Get paths of ${allXmsPath}`);
    const ret = JSONPath({
      path: allXmsPath,
      json: swagger,
      resultType: "all",
    });
    //const timeDuration = Date.now() - startTime;
    //console.log(`Get xmsKey ${timeDuration}: ${ret.length}.`);
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
      //console.log(`Get json by pointer: ${name}\n${attrPath}\n${JSON.stringify(reObj)}`);
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
