import { keywords, arrayKeywords, propsKeywords } from "json-schema-traverse";
import {
  SwaggerSpec,
  Operation,
  httpMethods,
  HttpMethods,
  Response,
  Path,
  Schema,
  Parameter,
  refSelfSymbol,
} from "./swaggerTypes";
import { FileSystemJsonLoader, $id } from "./fileSystemJsonLoader";

export interface AllSchemas {
  objSchemas: Schema[];
  arrSchemas: Schema[];
  primSchemas: Schema[];
  allParams: Parameter[];
}

export class SwaggerLoader {
  private readonly defaultMime = ["application/json"];

  // TODO handle http spec load
  public constructor(protected jsonLoader: FileSystemJsonLoader) {}

  // TODO reportError
  public async loadSpec(specFilePath: string): Promise<SwaggerSpec> {
    const swaggerSpec = (await (this.jsonLoader.load(specFilePath) as unknown)) as SwaggerSpec;
    swaggerSpec._filePath = specFilePath;

    return swaggerSpec;
  }

  public traverseSwagger(
    spec: SwaggerSpec,
    visitors: {
      // return false to skip following level
      onPath?: (path: Path, pathTemplate: string) => boolean | void;
      onOperation?: (operation: Operation, path: Path, method: HttpMethods) => boolean | void;
      onResponse?: (
        response: Response,
        operation: Operation,
        path: Path,
        statusCode: string
      ) => void;
    }
  ) {
    const { onPath, onOperation, onResponse } = visitors;
    const skipOperation = onOperation === undefined && onResponse === undefined;
    const skipResponse = onResponse === undefined;

    if (!spec.paths) {
      console.error("error");
    }

    for (const pathTemplate of Object.keys(spec.paths)) {
      const path = spec.paths[pathTemplate];
      if ((onPath !== undefined && onPath(path, pathTemplate) === false) || skipOperation) {
        continue;
      }

      for (const m of Object.keys(path)) {
        const method = m as HttpMethods;
        if (!httpMethods.includes(method as HttpMethods)) {
          continue;
        }

        const operation = path[method]!;
        if (
          (onOperation !== undefined && onOperation(operation, path, method) === false) ||
          skipResponse
        ) {
          continue;
        }

        for (const statusCode of Object.keys(operation.responses)) {
          const response = operation.responses[statusCode];
          onResponse!(response, operation, path, statusCode);
        }
      }
    }
  }

  public async traverseSwaggerAsync(
    spec: SwaggerSpec,
    visitors: {
      // return false to skip following level
      onPath?: (path: Path, pathTemplate: string) => Promise<boolean | void>;
      onOperation?: (
        operation: Operation,
        path: Path,
        method: HttpMethods
      ) => Promise<boolean | void>;
      onResponse?: (
        response: Response,
        operation: Operation,
        path: Path,
        statusCode: string
      ) => Promise<void>;
    }
  ) {
    const { onPath, onOperation, onResponse } = visitors;
    const skipOperation = onOperation === undefined && onResponse === undefined;
    const skipResponse = onResponse === undefined;

    if (!spec.paths) {
      console.error("error");
    }

    for (const pathTemplate of Object.keys(spec.paths)) {
      const path = spec.paths[pathTemplate];
      if ((onPath !== undefined && (await onPath(path, pathTemplate)) === false) || skipOperation) {
        continue;
      }

      for (const m of Object.keys(path)) {
        const method = m as HttpMethods;
        if (!httpMethods.includes(method as HttpMethods)) {
          continue;
        }

        const operation = path[method]!;
        if (
          (onOperation !== undefined && (await onOperation(operation, path, method)) === false) ||
          skipResponse
        ) {
          continue;
        }

        for (const statusCode of Object.keys(operation.responses)) {
          const response = operation.responses[statusCode];
          await onResponse!(response, operation, path, statusCode);
        }
      }
    }
  }

  protected setReferenceFields(spec: SwaggerSpec) {
    if (spec.consumes === undefined || this.isDefaultMime(spec.consumes)) {
      spec.consumes = this.defaultMime;
    }
    if (spec.produces === undefined || this.isDefaultMime(spec.produces)) {
      spec.produces = this.defaultMime;
    }
    this.traverseSwagger(spec, {
      onPath: (path, pathTemplate) => {
        path._spec = spec;
        path._pathTemplate = pathTemplate;
      },
      onOperation: (operation, path) => {
        operation._path = path;
        if (operation.consumes === undefined) {
          operation.consumes = spec.consumes;
        } else if (this.isDefaultMime(operation.consumes)) {
          operation.consumes = this.defaultMime;
        }
        if (operation.produces === undefined) {
          operation.produces = spec.produces;
        } else if (this.isDefaultMime(operation.produces)) {
          operation.produces = this.defaultMime;
        }
      },
    });
  }

  protected getAllNestedDefinitions(spec: SwaggerSpec, visited: Set<Schema>, output: AllSchemas) {
    const visitNestedDefinitions = (s: Schema | undefined, ref?: string) => {
      if (s === undefined || s === null || typeof s !== "object") {
        return;
      }
      const schema = this.jsonLoader.resolveRefObj(s);
      if (visited.has(schema)) {
        return;
      }
      visited.add(schema);

      const refSelf = schema === s ? ref : (s as any).$ref;
      if (refSelf !== undefined) {
        schema[refSelfSymbol] = refSelf;
      }
      if (schema.type === undefined || schema.type === "object") {
        output.objSchemas.push(schema);
      } else if (schema.type === "array") {
        output.arrSchemas.push(schema);
      } else {
        output.primSchemas.push(schema);
      }

      for (const key of Object.keys(schema)) {
        const sch = (schema as any)[key];
        const refSch = refSelf?.concat("/", key);
        if (Array.isArray(sch)) {
          if (key in arrayKeywords) {
            for (let idx = 0; idx < sch.length; ++idx) {
              visitNestedDefinitions(sch[idx], refSch?.concat("/", idx.toString()));
            }
          }
        } else if (key in propsKeywords) {
          if (typeof sch === "object" && sch !== null) {
            for (const prop of Object.keys(sch)) {
              visitNestedDefinitions(sch[prop], refSch?.concat("/", prop));
            }
          }
        } else if (key in keywords) {
          visitNestedDefinitions(sch, refSch);
        }
      }
    };

    const visitParameters = (x: Path | Operation) => {
      if (x.parameters !== undefined) {
        for (const p of x.parameters) {
          const param = this.jsonLoader.resolveRefObj(p);
          if (param.in === "body") {
            visitNestedDefinitions(param.schema);
          }
          output.allParams.push(param);
        }
      }
    };

    this.traverseSwagger(spec, {
      onPath: visitParameters,
      onOperation: visitParameters,
      onResponse: (response) => {
        visitNestedDefinitions(response.schema);
      },
    });

    if (spec.definitions !== undefined) {
      for (const key of Object.keys(spec.definitions)) {
        visitNestedDefinitions(spec.definitions[key], `${spec[$id]}#/definitions/${key}`);
      }
    }

    if (spec.parameters !== undefined) {
      for (const key of Object.keys(spec.parameters)) {
        spec.parameters[key][refSelfSymbol] = `${spec[$id]}#/parameters/${key}`;
      }
    }
  }

  private isDefaultMime(mimes: string[]) {
    return mimes.length === 1 && mimes[0] === this.defaultMime[0];
  }
}
