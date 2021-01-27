import { Container, interfaces } from "inversify";
import {
  LiveValidatorLoader,
  LiveValidatorLoaderOption,
} from "./liveValidation/liveValidatorLoader";
import { FileLoader, FileLoaderOption } from "./swagger/fileLoader";
import { JsonLoader, JsonLoaderOption } from "./swagger/jsonLoader";
import { setDefaultOpts } from "./swagger/loader";
import { SuppressionLoader, SuppressionLoaderOption } from "./swagger/suppressionLoader";
import { SwaggerLoader, SwaggerLoaderOption } from "./swagger/swaggerLoader";
import { TestResourceLoader, TestResourceLoaderOption } from "./testScenario/testResourceLoader";
import { TYPES } from "./util/constants";

export const inversifyBindClasses = (container: Container, allOpts: AllOpts) => {
  container.bind(FileLoader).toSelf();
  container.bind(JsonLoader).toSelf();
  container.bind(SuppressionLoader).toSelf();
  container.bind(SwaggerLoader).toSelf();
  container.bind(LiveValidatorLoader).toSelf();
  container.bind(TestResourceLoader).toSelf();
  container.bind(TYPES.opts).toConstantValue(allOpts);
};

export type AllOpts = FileLoaderOption &
  JsonLoaderOption &
  SuppressionLoaderOption &
  SwaggerLoaderOption &
  LiveValidatorLoaderOption &
  TestResourceLoaderOption;

export const inversifyGetInstance = <T>(
  claz: interfaces.Newable<T>,
  opts: AllOpts &
    interfaces.ContainerOptions & {
      container?: Container;
    }
) => {
  if (opts.container === undefined) {
    setDefaultOpts(opts, {
      defaultScope: "Singleton",
    });
    opts.container = new Container(opts);
  }
  inversifyBindClasses(opts.container, opts);
  return opts.container.get(claz);
};
