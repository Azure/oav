import { MutableStringMap } from "@azure-tools/openapi-tools-common";
import { SwaggerObject } from "yasway";

export type DocCache = MutableStringMap<Promise<SwaggerObject>>;
