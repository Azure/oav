export interface Loader<Output, Input = string> {
  load(input: Input): Promise<Output>;
}

export const getLoaderBuilder = <Option extends object, LoaderClass>(
  ctor: (opts: Option) => LoaderClass
) => {
  const cache = new WeakMap<Option, LoaderClass>();

  return (opts: Option) => {
    let instance = cache.get(opts);
    if (instance === undefined) {
      instance = ctor(opts);
      cache.set(opts, instance);
    }
    return instance;
  };
};

export const setDefaultOpts = <Option extends object>(opts: Option, defaults: Option) => {
  for (const k of Object.keys(defaults)) {
    const key = k as keyof Option;
    if (opts[key] === undefined) {
      opts[key] = defaults[key];
    }
  }
};
