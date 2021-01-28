import { Container, interfaces } from "inversify";
import { setDefaultOpts } from "./swagger/loader";

export const TYPES = {
  opts: Symbol("InversifyTYPES.opts"),
};

export const inversifyGetInstance = <T, Opt = {}>(
  claz: interfaces.Newable<T>,
  opts: Opt &
    interfaces.ContainerOptions & {
      container?: Container;
    }
) => {
  if (opts.container === undefined) {
    setDefaultOpts(opts, {
      defaultScope: "Singleton",
      autoBindInjectable: true,
    } as any);
    opts.container = new Container(opts);
  }
  opts.container.bind(TYPES.opts).toConstantValue(opts);
  return opts.container.get(claz);
};
