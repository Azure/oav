import { Container, type ContainerOptions, type Newable } from "inversify";
import { TYPES } from "./inversifyTypes.js";
import { setDefaultOpts } from "./swagger/loader.js";
import { AjvSchemaValidator } from "./swaggerValidator/ajvSchemaValidator.js";

export { TYPES } from "./inversifyTypes.js";

export const inversifyGetContainer = (opts: ContainerOptions = {}) => {
  setDefaultOpts(opts, {
    defaultScope: "Singleton",
    autobind: true,
  } as any);
  return new Container(opts);
};

export const inversifyGetInstance = <T, Opt = {}>(
  claz: Newable<T>,
  opts: Opt &
    ContainerOptions & {
      container?: Container;
    }
) => {
  if (opts.container === undefined) {
    opts.container = inversifyGetContainer(opts);
  }
  opts.container.bind(TYPES.opts).toConstantValue(opts);
  opts.container.bind(TYPES.emptyObject).toConstantValue({});
  opts.container.bind(TYPES.schemaValidator).to(AjvSchemaValidator);
  return opts.container.get(claz);
};
