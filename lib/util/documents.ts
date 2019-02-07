import { MutableStringMap } from '@ts-common/string-map'
import { SwaggerObject } from 'yasway'

export type DocCache = MutableStringMap<Promise<SwaggerObject>>

/*
 * Caches the json docs that were successfully parsed by parseJson().
 * This avoids, fetching them again.
 * key: docPath
 * value: parsed doc in JSON format
 */
export let docCache: DocCache = {}

export const clearCache = () => { docCache = {} }
