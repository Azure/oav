import { JsonLoader } from "../swagger/jsonLoader";
import {
  buildItemOption,
  CacheItem,
  createLeafItem,
  createTrunkItem,
  MockerCache,
  reBuildExample,
} from "./exampleCache";
import Mocker from "./mocker";
import * as util from "./util";

export default class SwaggerMocker {
  private jsonLoader: JsonLoader;
  private mocker: Mocker;
  private spec: any;
  private cache: MockerCache;

  public constructor(jsonLoader: JsonLoader, mockerCache: MockerCache) {
    this.jsonLoader = jsonLoader;
    this.mocker = new Mocker();
    this.cache = mockerCache;
  }

  public mockForExample(example: any, specItem: any, spec: any, rp: string) {
    this.spec = spec;
    if (Object.keys(example.responses).length === 0) {
      for (const statusCode of Object.keys(specItem.content.responses)) {
        if (statusCode !== "default") {
          example.responses[`${statusCode}`] = {};
        }
      }
    }
    example.parameters = this.mockRequest(example.parameters, specItem.content.parameters, rp);
    example.responses = this.mockResponse(example.responses, specItem);
  }

  private mockResponse(responseExample: any, specItem: any) {
    for (const statusCode of Object.keys(responseExample)) {
      const mockedResp = this.mockEachResponse(statusCode, responseExample[statusCode], specItem);
      responseExample[statusCode] = mockedResp;
    }
    return responseExample;
  }

  private mockEachResponse(statusCode: string, responseExample: any, specItem: any) {
    const visited = new Set<string>();
    const responseSpec = specItem.content.responses[statusCode];
    return {
      headers: responseExample.hearders || this.mockHeaders(statusCode, specItem),
      body:
        "schema" in responseSpec
          ? this.mockObj(
              "response body",
              responseSpec.schema,
              responseExample.body || {},
              visited,
              false
            )
          : undefined,
    };
  }

  private mockHeaders(statusCode: string, specItem: any) {
    if (statusCode !== "201" && statusCode !== "202") {
      return undefined;
    }
    const headerAttr = util.getPollingAttr(specItem);
    if (!headerAttr) {
      return;
    }
    return {
      [headerAttr]: "LocationURl",
    };
  }

  private mockRequest(paramExample: any, paramSpec: any, rp: string) {
    for (const pName of Object.keys(paramSpec)) {
      const element = paramSpec[pName];
      const visited = new Set<string>();

      const paramEle = this.getDefSpec(element, visited);
      if (paramEle.name === "resourceGroupName") {
        paramExample.resourceGroupName = `rg${rp}`;
      } else if (paramEle.name === "api-version") {
        paramExample["api-version"] = this.spec.info.version;
      } else if ("schema" in paramEle) {
        // {
        //     "name": "parameters",
        //     "in": "body",
        //     "required": false,
        //     "schema": {
        //       "$ref": "#/definitions/SignalRResource"
        //     }
        // }
        paramExample[paramEle.name] = this.mockObj(
          paramEle.name,
          paramEle.schema,
          paramExample[paramEle.name] || {},
          visited,
          true
        );
      } else {
        if (paramEle.name in paramExample) {
          continue;
        }
        // {
        //     "name": "api-version",
        //     "in": "query",
        //     "required": true,
        //     "type": "string"
        // }
        paramExample[paramEle.name] = this.mockObj(
          paramEle.name,
          paramEle,
          paramExample[paramEle.name],
          visited,
          true
        );
      }
    }
    return paramExample;
  }

  private removeFromSet(schema: any, visited: Set<string>) {
    if ("$ref" in schema && visited.has(schema.$ref)) {
      visited.delete(schema.$ref);
    }
  }

  private getSpecDefinition(name: string) {
    return this.spec.definitions[name];
  }

  private getSpecByDiscriminatorValue(value: string) {
    const spec = this.getSpecDefinition(value);
    if (spec) {
      return spec;
    }
    for (const definition of Object.values(this.spec.definitions)) {
      if ((definition as any)["x-ms-discriminator-value"] === value) {
        return definition;
      }
    }
    return undefined;
  }

  private mockObj(
    objName: string,
    schema: any,
    example: any,
    visited: Set<string>,
    isRequest: boolean
  ) {
    const cache = this.mockCachedObj(objName, schema, example, visited, isRequest);
    return reBuildExample(cache, isRequest);
  }

  private mockCachedObj(
    objName: string,
    schema: any,
    example: any,
    visited: Set<string>,
    isRequest: boolean
  ) {
    if (!schema || typeof schema !== "object") {
      console.log(`The schema is invalid.`);
      return undefined;
    }
    // use visited set to avoid circular dependency
    if ("$ref" in schema && visited.has(schema.$ref)) {
      return undefined;
    }
    if ("$ref" in schema && this.cache.has(schema.$ref.split("#")[1])) {
      return this.cache.get(schema.$ref.split("#")[1]);
    }

    const definitionSpec = this.getDefSpec(schema, visited);

    if (util.isObject(definitionSpec)) {
      // circular inherit will not be handled
      const properties = this.getProperties(definitionSpec, visited);
      example = example || {};
      const discriminator = definitionSpec.discriminator;
      if (properties && Object.keys(properties).includes(discriminator)) {
        example = this.mockForDiscriminator(
          properties[discriminator],
          example,
          discriminator,
          isRequest,
          visited
        );
      } else {
        Object.keys(properties).forEach((key: string) => {
          example[key] = this.mockCachedObj(key, properties[key], example[key], visited, isRequest);
        });
      }
      if ("additionalProperties" in definitionSpec && definitionSpec.additionalProperties) {
        const newkey = util.randomKey();
        if (newkey in properties) {
          console.error(`generate additionalProperties for ${objName} fail`);
        } else {
          example[newkey] = this.mockCachedObj(
            newkey,
            definitionSpec.additionalProperties,
            undefined,
            visited,
            isRequest
          );
        }
      }
    } else if (definitionSpec.type === "array") {
      example = example || [];
      const arrItem: any = this.mockCachedObj(
        `${objName}'s item`,
        definitionSpec.items,
        example[0],
        visited,
        isRequest
      );
      example = this.mocker.mock(definitionSpec, objName, arrItem);
    } else {
      /** type === number or integer  */
      example = example ? example : this.mocker.mock(definitionSpec, objName);
    }
    // return value for primary type: string, number, integer, boolean
    // "aaaa"
    // removeFromSet: once we try all roads started from present node, we should remove it and backtrack
    this.removeFromSet(schema, visited);

    let cacheItem: CacheItem;
    if (Array.isArray(example)) {
      const cacheChild: CacheItem[] = [];
      for (const item of example) {
        cacheChild.push(item);
      }
      cacheItem = createTrunkItem(cacheChild, buildItemOption(definitionSpec));
    } else if (typeof example === "object") {
      const cacheChild: { [index: string]: CacheItem } = {};
      for (const [key, item] of Object.entries(example)) {
        cacheChild[key] = item as CacheItem;
      }
      cacheItem = createTrunkItem(cacheChild, buildItemOption(definitionSpec));
    } else {
      cacheItem = createLeafItem(example, buildItemOption(definitionSpec));
    }

    if (schema.$ref) {
      this.cache.checkAndCache(schema, cacheItem);
    }
    return cacheItem;
  }

  // TODO: handle discriminator without enum options
  private mockForDiscriminator(
    schema: any,
    example: any,
    discriminator: string,
    isRequest: boolean,
    visited: Set<string>
  ) {
    const disDetail = this.getDefSpec(schema, visited);
    if ("enum" in disDetail) {
      const discriminatorSpec = this.getSpecByDiscriminatorValue(disDetail.enum[0]);
      if (!discriminatorSpec) {
        return example;
      }
      const cacheItem = this.mockCachedObj(
        discriminator,
        discriminatorSpec,
        {},
        visited,
        isRequest
      );
      example[discriminator] = createLeafItem(disDetail.enum[0]);
      return {
        ...example,
        ...cacheItem?.child,
      };
    }
    this.removeFromSet(schema, visited);
    return example;
  }

  // {
  //  "$ref": "#/parameters/ApiVersionParameter"
  // },
  // to
  // {
  //     "name": "api-version",
  //     "in": "query",
  //     "required": true,
  //     "type": "string"
  // }
  private getDefSpec(schema: any, visited: Set<string>) {
    if ("$ref" in schema) {
      visited.add(schema.$ref);
    }

    const content = this.jsonLoader.resolveRefObj(schema);
    if (!content) {
      return undefined;
    }
    return content;
  }

  private getProperties(definitionSpec: any, visited: Set<string>) {
    let properties: any = {};
    definitionSpec.allOf?.map((item: any) => {
      properties = {
        ...properties,
        ...this.getProperties(this.getDefSpec(item, visited), visited),
      };
    });
    return {
      ...properties,
      ...definitionSpec.properties,
    };
  }
}
