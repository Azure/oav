export interface Loader<Output, Input = string> {
  load(input: Input): Promise<Output>;
}

export const setDefaultOpts = <Option extends object>(opts: Option, defaults: Option) => {
  for (const k of Object.keys(defaults)) {
    const key = k as keyof Option;
    if (opts[key] === undefined) {
      opts[key] = defaults[key];
    }
  }
};
