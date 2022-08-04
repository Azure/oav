import { injectable } from "inversify";
import { Json, readFile as vfsReadFile } from "@azure-tools/openapi-tools-common";
import { JSONPath } from "jsonpath-plus";
import $RefParser, { FileInfo } from "@apidevtools/json-schema-ref-parser";
import { FileLoader, FileLoaderOption } from "../swagger/fileLoader";
import { xmsExamples } from "../util/constants";

export interface OperationLoaderOption extends FileLoaderOption {
  //Rules will be applied to swagger: readonly: readOnly=true
  supportYaml?: boolean;
  useJsonParser?: boolean;
}

//readOnly: [RestorePointCollection.properties.provisioningState]
type Operation = Map<string, string[]>;
//RestorePointCollections_CreateOrUpdate
type ApiVersion = Map<string, Operation>;
//2021-11-01
type Provider = Map<string, ApiVersion>;

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
    ["example", "$..[?(@['x-ms-examples'])]~"],
  ]);
  private fileLoader: FileLoader;

  public constructor(fileLoader: FileLoader, ruleMap: Map<string, string>) {
    ruleMap.forEach((value: string, key: string) => {
      this.ruleMap.set(key, value);
    });
    this.fileLoader = fileLoader;
  }

  public async init(inputFilePath: string): Promise<Json> {
    const providerName = this.parseProviderName(inputFilePath);
    if (providerName === undefined) {
      console.log(`Illegal file path, unable to extract provider name ${inputFilePath}`);
      return {};
    }
    console.log(`Provider Name: ${providerName}`);
    const spec = await this.load(inputFilePath);
    //console.log(`Loaded spec: ${JSON.stringify(spec)}`);
    const apiVersion = JSON.parse(JSON.stringify(spec))["info"]["version"];
    console.log(`Api version ${apiVersion}`);

    const allOperations = await this.getAllTargetKey("$..[?(@.operationId)]~", spec);
    allOperations.forEach((op) => {
      const path = op.path;
      const parent = op.parent;
      const operation = parent[op.value];
      const operationId = operation["operationId"];
      console.log(`operationId: ${operationId}, path: ${path}`);
      this.ruleMap.forEach(async (value: string, key: string) => {
        const attrs = await this.getAllTargetKey(value, operation);
        console.log(`${key}: ${attrs.length}`);
      });
    });

    return spec;
  }

  private async load(inputFilePath: string): Promise<Json> {
    //Read content from swagger file and
    let fileContent = JSON.parse(await this.fileLoader.load(inputFilePath));

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
      const deDoc = await parser.dereference(inputFilePath, fileContent, resolveOption);
      console.log(`Deferenced: ${JSON.stringify(deDoc.definitions!.ApiCollection)}`);
    } catch (err) {
      console.error(err);
      return {};
    }

    return fileContent;
  }

  public attrChecker(
    jsonPath: string,
    attrs: string[],
    providerName: string,
    apiVersion: string,
    operationId: string
  ) {
    let tag: boolean = false;
    const attrMap = this.getAttrs(providerName, apiVersion, operationId);
    if (attrMap === undefined) {
      return false;
    }
    for (const attr of attrs) {
      const paths = attrMap.get(attr);
      if (paths === undefined) {
        continue;
      }
      if (paths.includes(jsonPath)) {
        tag = true;
        return tag;
      }
    }
    return tag;
  }

  private getAttrs(providerName: string, apiVersion: string, operationId: string) {
    return this.cache.get(providerName)?.get(apiVersion)?.get(operationId);
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

  private async getAllTargetKey(allXmsPath: string, swagger: any): Promise<any[]> {
    //console.log(`Get paths of ${allXmsPath}`);
    const ret = JSONPath({
      path: allXmsPath,
      json: swagger,
      resultType: "all",
    });
    //console.log(`Get xmsKey: ${ret.length}.`);
    return ret;
  }
}

export function isExample(path: string) {
  return path.split(/\\|\//g).includes("examples");
}

export async function loadSingleFile(filePath: string) {
  const fileString = await vfsReadFile(filePath);
  return JSON.parse(fileString);
}
