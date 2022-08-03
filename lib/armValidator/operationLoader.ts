import { injectable } from "inversify";
import { Json } from "@azure-tools/openapi-tools-common";
import { JSONPath } from "jsonpath-plus";
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
    const spec = await this.load(inputFilePath);
    console.log(`Loaded spec: ${JSON.stringify(spec)}`);

    let exampels = await this.getAllTargetKey(this.ruleMap.get("example")!, spec);
    console.log("Example:");
    exampels.forEach((a) => console.log(a));
    this.removeProperty(spec);
    exampels = await this.getAllTargetKey(this.ruleMap.get("example")!, spec);
    console.log("Example:");
    exampels.forEach((a) => console.log(a));

    let attrs = await this.getAllTargetKey(this.ruleMap.get("secret")!, spec);
    console.log("secret:");
    attrs.forEach((a) => console.log(a));
    attrs = await this.getAllTargetKey(this.ruleMap.get("readOnly")!, spec);
    console.log("readOnly:");
    attrs.forEach((a) => console.log(a));
    return spec;
  }

  private async load(inputFilePath: string): Promise<Json> {
    const providerName = this.parseProviderName(inputFilePath);
    if (providerName === undefined) {
      console.log(`Illegal file path, unable to extract provider name ${inputFilePath}`);
      return {};
    }
    console.log(`Provider Name: ${providerName}`);
    //Read content from swagger file and
    const fileString = await this.fileLoader.load(inputFilePath);

    let fileContent = JSON.parse(fileString);
    /*console.log("1");
    let allXmsSecretKeys = JSONPath({
      path: '$..[?(@["x-ms-secret"])]~',
      json: fileContent,
      resultType: "all",
    });
    for (const a in allXmsSecretKeys) {
      console.log(a);
    }*/
    const apiVersion = fileContent["info"]["version"];
    console.log(`api version ${apiVersion}`);
    //this.removeProperty(fileContent);
    /*console.log("2");
    allXmsSecretKeys = JSONPath({
      path: '$..[?(@["x-ms-secret"])]~',
      json: fileContent,
      resultType: "all",
    });
    for (const a in allXmsSecretKeys) {
      console.log(a);
    }
    console.log("3");*/
    //remove unnecessary properties

    //resolve all refs using lib: https://github.com/APIDevTools/json-schema-ref-parser
    //return resolved swagger

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

  private async getAllTargetKey(allXmsPath: string, swagger: any): Promise<string[]> {
    console.log(`Get paths of ${allXmsPath}`);
    const ret = JSONPath({
      path: allXmsPath,
      json: swagger,
    });
    console.log(`Get xmsKey: ${ret.length}. ${ret.join("\n")}\n`);

    /*
    let allXmsSecretKeys = JSONPath({
      path: "$..[?(@['x-ms-examples'])]~",
      json: swagger,
      resultType: "all",
    });
    for (const a in allXmsSecretKeys) {
      console.log(a);
    }
    allXmsSecretKeys = JSONPath({
      path: '$..[?(@["x-ms-examples"])]~',
      json: swagger,
      resultType: "all",
    });
    for (const a in allXmsSecretKeys) {
      console.log(a);
    }*/
    /*
    const allXmsSecretKeys = JSONPath({
      path: '$..[?(@["x-ms-secret"])]~',
      json: swagger,
      resultType: "all",
    });
    for (const a in allXmsSecretKeys) {
      console.log(a);
    }*/
    return ret;
  }
}
