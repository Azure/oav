import { inject, injectable } from "inversify";
import { FileLoader, FileLoaderOption } from "../swagger/fileLoader";
import { Json, parseJson } from "@azure-tools/openapi-tools-common";
import { TYPES } from "../inversifyUtils";
import { load as parseYaml } from "js-yaml";
import { at } from "lodash";
import { joinPath } from "../util/utils";

export interface OperationLoaderOption extends FileLoaderOption {
  //Rules will be applied to swagger: readonly: readOnly=true
  skipResolveRefKeys?: string[];
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

  private skipResolveRefKeys: Set<string>;

  public constructor(
    @inject(TYPES.opts) private opts: OperationLoaderOption,
    private fileLoader: FileLoader,
    private ruleMap: Map<string, string>
  ) {
    this.skipResolveRefKeys = new Set(opts.skipResolveRefKeys);
  }

  private getAttrs(providerName: string, apiVersion: string, operationId: string) {
    return this.cache.get(providerName)?.get(apiVersion)?.get(operationId);
  }

  private async load(inputFilePath: string): Promise<Json> {
    const fileString = await this.fileLoader.load(inputFilePath);
    let fileContent = this.parseFileContent(inputFilePath, fileString);
    //Read content from swagger file and
    //remove unnecessary properties
    //resolve all refs using lib: https://github.com/APIDevTools/json-schema-ref-parser
    //return resolved swagger

    return fileContent;
  }

  private jsonPathBuiler(spec: Json, providerName: string) {
    //Use JSONPath() to extract jsonPath of the object: readOnly = true
    this.ruleMap.forEach((value: string, key: string) => {
      //add jsonPath to cache
    });
  }

  public attrChecker(jsonPath: string, attrs: string[], providerName: string, apiVersion: string, operationId: string) {
    let tag: boolean = false;
    const attrMap = this.getAttrs(providerName, apiVersion, operationId);
    if (attrMap === undefined) {
      tag = false;
      return tag;
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

  private parseFileContent(filePath: string, fileString: string): any {
    if (
      this.opts.supportYaml &&
      (filePath.endsWith(".yaml") || filePath.endsWith(".yml"))
    ) {
      return parseYaml(fileString, {
        filename: filePath,
        json: true,
      });
    }

    return this.opts.useJsonParser ? parseJson(filePath, fileString) : JSON.parse(fileString);

    // throw new Error(`Unknown file format while loading file ${cache.filePath}`);
  }

  private parseProviderName(filePath: string) {
    const rpReg = new RegExp("\/resource-manager\/(.*?)\/", 'i');
    //let testStr = "https://github.com/Azure/azure-rest-api-specs/blob/main/specification/securityinsights/resource-manager/Microsoft.SecurityInsights/preview/2019-01-01-preview/Aggregations.json"
    const result = filePath.match(rpReg);
    if (result) {
      return result[1];
    }
    return;
  }

}