import { createContext, Script } from "vm";

function internalGet(this: { args: { [key: string]: any }; readmeMd: string; result: any }) {
  const { getAutorestConfigInternal } = require("./getAutorestConfigInternal");
  this.result = getAutorestConfigInternal(this.args, this.readmeMd);
}

const internalGetScript = new Script(`(${internalGet.toString()})(this)`);

export const getAutorestConfig = async (args: { [key: string]: any }, readmeMd: string) => {
  const context = createContext();
  context.args = args;
  context.readmeMd = readmeMd;
  context.require = require;

  internalGetScript.runInContext(context);
  return context.result;
};
