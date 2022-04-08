import { homedir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import * as autorest from "autorest";
import { IFileSystem } from "autorest";

function parseArgs(args: { [key: string]: any }): any[] {
  const switches: any[] = [args];
  const Parse = (rawValue: string) => {
    try {
      const value = JSON.parse(rawValue);
      return value;
    } catch (e) {
      return rawValue;
    }
  };
  for (const key of Object.keys(args)) {
    let value = args[key];
    if (value === true) {
      switches.push({
        "try-require": `readme.${key}.md`,
      });
    } else if (typeof value === "string") {
      if (value.startsWith(".")) {
        // starts with a . or .. -> this is a relative path to current directory
        value = join(process.cwd(), value);
      }

      if (value.startsWith("~/")) {
        // starts with a ~/ this is a relative path to home directory
        value = join(homedir(), value.substr(1));
      }
      switches.push({
        [key]: Parse(value),
      });
    }
  }

  return switches;
}

const getAutorest = async (version: string | undefined, rfs?: IFileSystem, readme?: string) => {
  await autorest.initialize(version);
  const autorestExecutor: autorest.AutoRest = await autorest.create(rfs, readme);
  return autorestExecutor;
};

const getAutorestCoreVersion = async (_args?: any) => {
  return "~3.5.1";
};

export const getAutorestConfigInternal = async (
  args: { [key: string]: any },
  readmeMd: string,
  rfs?: IFileSystem
) => {
  const autorestArgs = parseArgs(args);

  const selectedVersion = await getAutorestCoreVersion(autorestArgs);
  const api = await getAutorest(selectedVersion, rfs, pathToFileURL(readmeMd).href);
  api.AddConfiguration(autorestArgs);

  const view = await api.view;
  const rawConfig = view.rawConfig;
  return rawConfig;
};
