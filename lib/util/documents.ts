import { MutableStringMap } from "@ts-common/string-map"
import { SwaggerObject } from "yasway"

export type DocCache = MutableStringMap<Promise<SwaggerObject>>
