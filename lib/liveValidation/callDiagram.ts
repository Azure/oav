// /* eslint-disable no-lone-blocks */
// import { SwaggerLoader } from "../swagger/swaggerLoader.js";
// import { JsonLoader } from "../swagger/jsonLoader.js";
// import { SuppressionLoader } from "../swagger/suppressionLoader.js";
// import { SwaggerSpec } from "../swagger/swaggerTypes.js";
// import { applySpecTransformers } from "../transform/transformer.js";
// import { pathRegexTransformer } from "../transform/pathRegexTransformer.js";
// import { referenceFieldsTransformer } from "../transform/referenceFieldsTransformer.js";
// import { resolveNestedDefinitionTransformer } from "../transform/resolveNestedDefinitionTransformer.js";
// import { xmsPathsTransformer } from "../transform/xmsPathsTransformer.js";
// import { discriminatorTransformer } from "../transform/discriminatorTransformer.js";
// import { allOfTransformer } from "../transform/allOfTransformer.js";
// import { noAdditionalPropertiesTransformer } from "../transform/noAdditionalPropertiesTransformer.js";
// import { nullableTransformer } from "../transform/nullableTransformer.js";
// import { pureObjectTransformer } from "../transform/pureObjectTransformer.js";
// import {
//   AjvSchemaValidator,
//   ajvErrorToSchemaValidateIssue,
// } from "../swaggerValidator/ajvSchemaValidator.js";
// import { OperationSearcher } from "./operationSearcher.js";
// import { LiveValidatorLoader } from "./liveValidatorLoader.js";
// import { LiveValidator, RequestResponsePair } from "./liveValidator.js";
// import {
//   LiveRequest,
//   validateSwaggerLiveRequest,
//   schemaValidateIssueToLiveValidationIssue,
//   LiveResponse,
//   validateSwaggerLiveResponse,
// } from "./operationValidator.js";

// const opts = {};
// const ctx = {} as any;

// export const callDiagram = async () => {
//   const liveValidator = new LiveValidator();
//   const operationSearcher = new OperationSearcher(liveValidator.logging);
//   const jsonLoader = JsonLoader.create(opts);
//   const swaggerLoader = SwaggerLoader.create(opts);
//   const suppressionLoader = SuppressionLoader.create(opts);
//   const liveValidatorLoader = LiveValidatorLoader.create(opts);
//   const schemaValidator = new AjvSchemaValidator(jsonLoader);

//   // Initialize
//   await liveValidator.initialize();
//   {
//     const specPaths = await liveValidator.getSwaggerPaths();
//     const allSpecs = [];

//     for (const specPath of specPaths) {
//       const spec = await liveValidator.getSwaggerInitializer(liveValidatorLoader, specPath);
//       {
//         const spec = await liveValidatorLoader.load(specPath);
//         {
//           const spec = await swaggerLoader.load(specPath);
//           {
//             const spec = ((await jsonLoader.load(specPath)) as unknown) as SwaggerSpec;
//             await suppressionLoader.load(spec);
//           }

//           applySpecTransformers(spec, ctx);
//           {
//             const transformers = [
//               xmsPathsTransformer,
//               resolveNestedDefinitionTransformer,
//               referenceFieldsTransformer,
//               pathRegexTransformer,
//             ];
//             for (const transformer of transformers) {
//               transformer.transform(spec, ctx);
//             }
//           }
//         }

//         operationSearcher.addSpecToCache(spec);
//       }
//       allSpecs.push(spec!);
//     }

//     liveValidatorLoader.transformLoadedSpecs();
//     {
//       const transformers = [
//         discriminatorTransformer,
//         allOfTransformer,
//         noAdditionalPropertiesTransformer,
//         nullableTransformer,
//         pureObjectTransformer,
//       ];
//       for (const transformer of transformers) {
//         transformer.transform(ctx);
//       }
//     }

//     // eslint-disable-next-line @typescript-eslint/no-floating-promises
//     liveValidator.loadAllSpecValidatorInBackground(allSpecs);
//   }

//   // Validate request response
//   await liveValidator.validateLiveRequestResponse({} as RequestResponsePair);
//   {
//     await liveValidator.validateLiveRequest({} as LiveRequest);
//     {
//       const { info } = liveValidator.getOperationInfo({} as LiveRequest, "");
//       {
//         const operation = operationSearcher.search();
//       }

//       const requestIssues = await validateSwaggerLiveRequest({} as LiveRequest);
//       {
//         const validate = await liveValidatorLoader.getRequestValidator(
//           info.operationMatch!.operation
//         );
//         {
//           const schema = {
//             properties: {
//               headers: {},
//               query: {},
//               body: {},
//             },
//           };

//           const ajvValidator = schemaValidator.compile(schema);
//         }

//         const validateCtx = { isResponse: false };
//         const jsonSchemaErrors = validate(validateCtx, {});
//         {
//           const ajvErrors = ajvValidator(validateCtx, {});
//           jsonSchemaErrors = ajvErrors.map(ajvErrorToSchemaValidateIssue);
//         }
//         const liveValidationIssues = schemaValidateIssueToLiveValidationIssue(jsonSchemaErrors);
//       }
//     }

//     await liveValidator.validateLiveResponse({} as LiveResponse, {} as any);
//     {
//       const { info } = liveValidator.getOperationInfo({} as LiveRequest, "");

//       const responseIssues = await validateSwaggerLiveResponse({} as LiveResponse);
//       {
//         const validate = await liveValidatorLoader.getResponseValidator(
//           info.operationMatch!.operation.responses[200]
//         );
//         {
//           const schema = {
//             properties: {
//               headers: {},
//               body: {},
//             },
//           };

//           const ajvValidator = schemaValidator.compile(schema);
//         }

//         const validateCtx = { isResponse: true };
//         const jsonSchemaErrors = validate(validateCtx, {});
//         {
//           const ajvErrors = ajvValidator(validateCtx);
//           jsonSchemaErrors = ajvErrors.map(ajvErrorToSchemaValidateIssue);
//         }
//         const liveValidationIssues = schemaValidateIssueToLiveValidationIssue(jsonSchemaErrors);
//       }
//     }
//   }
// };
