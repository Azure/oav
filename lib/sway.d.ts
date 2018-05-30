declare module "sway" {
  interface Options {
    definition: any
    jsonRefs: { relativeBase: any }
    isPathCaseSensitive?: boolean
  }
  function create(options: Options): Promise<any>
}