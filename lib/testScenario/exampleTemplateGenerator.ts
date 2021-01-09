// import { SwaggerExample, Operation } from "../swagger/swaggerTypes";

// export class ExampleTemplateGenerator {
//   public generateExampleTemplate(example: SwaggerExample, operation: Operation) {
//     this.analysePathTemplate(operation._path._pathTemplate, operation);
//   }

//   private analysePathTemplate(pathTemplate: string, operation: Operation) {
//     const sp = pathTemplate.split("/");
//     if (sp[0] !== "") {
//       throw new Error(`pathTemplate must starts with "/": ${pathTemplate}`);
//     }
//     sp.shift();

//     const providerIdx = sp.lastIndexOf("providers");
//     if (providerIdx === -1) {
//       throw new Error(`pathTemplate without providers is not supported: ${pathTemplate}`);
//     }

//     const provider = sp[providerIdx + 1];
//     if (provider === undefined || this.paramName(provider) !== undefined || provider.length === 0) {
//       throw new Error(`provider name cannot be detected in path: ${pathTemplate}`);
//     }

//     const scopeSlice = sp.slice(0, providerIdx);
//     const resourceSlice = sp.slice(providerIdx + 2)

//     const resourceType = resourceSlice.filter((_, idx) => idx === 1 || idx % 2 === 0);
//     if (resourceSlice.length % 2 === 0) {
//     }


//   }

//   private paramName(pathSeg: string) {
//     if (pathSeg.startsWith("{") && pathSeg.endsWith("}")) {
//       return pathSeg.substr(0, pathSeg.length - 2);
//     }

//     return undefined;
//   }
// }
