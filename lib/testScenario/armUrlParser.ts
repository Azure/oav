import { HttpMethods } from "@azure/core-http";
import { injectable } from "inversify";
import { JsonLoader } from "../swagger/jsonLoader";
import { Operation, Parameter } from "../swagger/swaggerTypes";

export type ArmScopeType =
  | "Subscription"
  | "ResourceGroup"
  | "Tenant"
  | "ManagementGroup"
  | "Extension";

export type ArmMethodType =
  | "Get"
  | "GetCollection"
  | "CreateOrUpdate"
  | "Update"
  | "Delete"
  | "Head"
  | "Action";

export type ArmApiInfo = ReturnType<ArmUrlParser["parseArmApiInfo"]>;

@injectable()
export class ArmUrlParser {
  public constructor(private jsonLoader: JsonLoader) {}

  public parseArmApiInfo(path: string, method: HttpMethods, operation?: Operation) {
    const sp = path.split("/");
    if (sp[0] !== "") {
      throw new Error(`path must starts with "/": ${path}`);
    }
    sp.shift();

    let lastProviderIdx = sp.length - 1;
    while (lastProviderIdx >= 0) {
      if (sp[lastProviderIdx].toLowerCase() === "providers") {
        break;
      }
      lastProviderIdx--;
    }
    if (lastProviderIdx === -1) {
      const scopeInfo = this.getArmScopeInfo(sp, path);
      const methodInfo = this.getArmMethodInfo(sp, method, path, "", operation);
      return {
        scopePart: path,
        provider: "",
        ...scopeInfo,
        ...methodInfo,
      };
    }

    const provider = sp[lastProviderIdx + 1];
    if (provider === undefined || provider.length === 0) {
      throw new Error(`provider name cannot be detected in path: ${path}`);
    }
    const providerParamName = this.getParamNameForPathTemplate(provider);

    const firstProviderIdx = sp.findIndex((val) => val.toLowerCase() === "providers");
    const scopeSlice = sp.slice(0, firstProviderIdx);
    const scopePart = `/${scopeSlice.join("/")}`;
    const scopeInfo = this.getArmScopeInfo(scopeSlice, path);

    const resourceSlice = sp.slice(lastProviderIdx + 2);
    const methodInfo = this.getArmMethodInfo(resourceSlice, method, path, provider, operation);

    return {
      scopePart,
      providerParamName,
      provider,
      ...scopeInfo,
      ...methodInfo,
    };
  }

  private getArmScopeInfo(
    scopeSlice: string[],
    path: string
  ): {
    scopeType: ArmScopeType | undefined;
    subscriptionId?: string;
    resourceGroupName?: string;
    managementGroupName?: string;
  } {
    if (scopeSlice.length === 0) {
      const managementGroupMatch = /^\/providers\/Microsoft\.Management\/managementGroups\/(?<mgmtGroupName>[^\/]+*)/gi.exec(
        path
      );
      if (managementGroupMatch !== null) {
        return { scopeType: "ManagementGroup", managementGroupName: managementGroupMatch[1] };
      } else {
        return { scopeType: "Tenant" };
      }
    } else if (
      scopeSlice.length === 1 &&
      this.getParamNameForPathTemplate(scopeSlice[1]) !== undefined
    ) {
      // Special case for extension scope in swagger path template
      return { scopeType: undefined };
    } else if (scopeSlice.length === 2 && scopeSlice[0].toLowerCase() === "subscriptions") {
      return { scopeType: "Subscription", subscriptionId: scopeSlice[1] };
    } else if (
      scopeSlice.length === 4 &&
      scopeSlice[0].toLowerCase() === "subscriptions" &&
      scopeSlice[2].toLowerCase() === "resourcegroups"
    ) {
      return {
        scopeType: "ResourceGroup",
        subscriptionId: scopeSlice[1],
        resourceGroupName: scopeSlice[3],
      };
    } else {
      throw new Error(`Unknown scope type for path: ${path}`);
    }
  }

  private getArmMethodInfo(
    resourceSlice: string[],
    httpMethod: HttpMethods,
    path: string,
    provider: string,
    operation?: Operation
  ) {
    let resourceUri = path;
    let actionName: string | undefined = undefined;
    const resourcePart = `/${resourceSlice.join("/")}`;
    const resourceTypeArr = resourceSlice.filter((_, idx) => idx % 2 === 0);
    const resourceNameArr = resourceSlice.filter((_, idx) => idx % 2 === 1);

    const methodTypeMap: { [key in HttpMethods]?: ArmMethodType } = {
      PUT: "CreateOrUpdate",
      DELETE: "Delete",
      GET: resourceSlice.length % 2 === 0 ? "Get" : "GetCollection",
      PATCH: "Update",
      HEAD: "Head",
      POST: "Action",
    };
    const methodType = methodTypeMap[httpMethod];
    if (methodType === undefined) {
      throw new Error(`Unsupported http method ${httpMethod} in path: ${resourcePart}`);
    }

    if (methodType === "Action") {
      if (resourceSlice.length % 2 === 0) {
        // throw new Error(
        //   `Invalid ARM action part, should contains odd path segments: ${resourcePart}`
        // );
        console.log(`Invalid ARM action part, should contains odd path segments: ${path}`);
      }
      actionName = resourceTypeArr.pop();
      resourceUri = path.slice(0, path.lastIndexOf("/"));
    }

    const resourceName = resourceNameArr.join("/");
    let resourceTypes: string[] = [provider];
    if (operation === undefined) {
      resourceTypes[0] = `${provider}/${resourceTypeArr.join("/")}`;
    } else {
      for (const seg of resourceTypeArr) {
        const paramName = this.getParamNameForPathTemplate(seg);
        if (paramName === undefined) {
          resourceTypes = resourceTypes.map((t) => `${t}/${seg}`);
        } else {
          const segTypes = this.getPathParamEnumValues(operation, paramName);
          resourceTypes = resourceTypes
            .map((t) => segTypes.map((s) => `${t}/${s}`))
            .reduce((a, b) => a.concat(b), []);
        }
      }
    }

    return {
      actionName,
      methodType,
      resourceName,
      resourceTypes,
      resourceUri,
      resourcePart,
    };
  }

  private getPathParamEnumValues(operation: Operation, paramName: string): string[] {
    let param: Parameter | undefined = undefined;
    for (const p of operation.parameters ?? []) {
      const pa = this.jsonLoader.resolveRefObj(p);
      if (pa.name === paramName) {
        param = pa;
        break;
      }
    }
    if (param === undefined) {
      throw new Error(
        `Parameter name ${paramName} not found for operation ${operation.operationId}`
      );
    }
    if (param.in !== "path") {
      throw new Error(
        `Parameter ${paramName} is not in path for operation ${operation.operationId}`
      );
    }
    if (param.enum === undefined || param.enum.length === 0) {
      throw new Error(
        `Parameter ${paramName} without enum definition is not supported for operation ${operation.operationId}`
      );
    }

    return param.enum as string[];
  }

  private getParamNameForPathTemplate(pathSeg: string) {
    if (pathSeg.startsWith("{") && pathSeg.endsWith("}")) {
      return pathSeg.substr(0, pathSeg.length - 2);
    }

    return undefined;
  }
}
