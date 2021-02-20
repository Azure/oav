import { applyOperation } from "fast-json-patch";
import { inject, injectable } from "inversify";
import { cloneDeep } from "lodash";
import { TYPES } from "../inversifyUtils";
import { Schema } from "../swagger/swaggerTypes";
import { SchemaValidator } from "../swaggerValidator/schemaValidator";
import { jsonPathToPointer } from "../util/jsonUtils";

@injectable()
export class BodyTransformer {
  public constructor(@inject(TYPES.schemaValidator) private validator: SchemaValidator) {}

  public async responseBodyToRequest(body: any, responseSchema: Schema): Promise<any> {
    const validateFn = await this.validator.compileAsync(responseSchema);
    // Readonly field cannot be set in response, so we could filter readonly fields
    const errors = validateFn(
      { isResponse: false, includeErrors: ["READONLY_PROPERTY_NOT_ALLOWED_IN_REQUEST"] },
      body
    );

    const result = cloneDeep(body);
    for (const err of errors) {
      for (const jsonPath of err.jsonPathsInPayload) {
        const jsonPointer = jsonPathToPointer(jsonPath);
        applyOperation(result, { op: "remove", path: jsonPointer });
      }
    }

    // console.log(body);
    // console.log(errors);
    // console.log(result);

    return result;
  }

  public async requestBodyToResponse(body: any, requestSchema: Schema): Promise<any> {
    const validateFn = await this.validator.compileAsync(requestSchema);
    // Writeonly field cannot be set in request, so we could filter writeonly fields
    const errors = validateFn(
      {
        isResponse: false,
        includeErrors: ["WRITEONLY_PROPERTY_NOT_ALLOWED_IN_RESPONSE", "SECRET_PROPERTY"],
      },
      body
    );

    const result = cloneDeep(body);
    for (const err of errors) {
      for (const jsonPath of err.jsonPathsInPayload) {
        const jsonPointer = jsonPathToPointer(jsonPath);
        applyOperation(result, { op: "remove", path: jsonPointer });
      }
    }

    // console.log(body);
    // console.log(errors);
    // console.log(result);

    return result;
  }
}
