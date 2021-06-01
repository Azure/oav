const allowedVariableName = "a-zA-Z0-9_\\-\\.";
const allowedVariableNameRegExp = new RegExp(`^[${allowedVariableName}]+$`);
const regExpCache: { [key: string]: RegExp } = {};

export const escapeRegExp = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
};

export class VariableEnv {
  protected baseEnv?: VariableEnv;
  protected data: { [key: string]: string } = {};
  protected writeEnv: { [key: string]: string };

  public constructor(baseEnv?: VariableEnv) {
    if (baseEnv !== undefined) {
      this.data.__proto__ = baseEnv.data as any;
      this.baseEnv = baseEnv;
    }
    this.writeEnv = this.data;
  }

  public clear() {
    for (const key of Object.keys(this.data)) {
      delete this.data[key];
    }
  }

  public get(key: string): string | undefined {
    return this.data[key];
  }

  public getRequired(key: string): string {
    const val = this.get(key);
    if (val === undefined) {
      throw new Error(`Variable is required but is not found in VariableEnv: ${key}`);
    }
    return val;
  }

  public getBaseEnv() {
    return this.baseEnv;
  }

  public set(key: string, value: string) {
    if (allowedVariableNameRegExp.exec(key) === null) {
      throw new Error(`Variable name is not allowed with [${allowedVariableName}]: ${key}`);
    }
    this.writeEnv[key] = value;
  }

  public setBatch(values: { [key: string]: string }) {
    if (values === undefined) {
      return;
    }
    for (const key of Object.keys(values)) {
      this.set(key, values[key]);
    }
  }

  public setWriteEnv(env: VariableEnv) {
    this.writeEnv = env.data;
  }

  public resolveString(source: string, matchLeft: string = "\\$\\(", matchRight: string = "\\)") {
    return this.resolveStringWithRegExp(source, this.getVariableRegExp(matchLeft, matchRight));
  }

  private resolveStringWithRegExp(source: string, captureVariable: RegExp) {
    let str = source;
    let count = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const matchResult = captureVariable.exec(str);
      if (matchResult === null) {
        return str;
      }

      count++;
      if (count > 100) {
        throw new Error(`More than ${count} times of variable replace in: ${source}`);
      }

      const match = matchResult[0];
      const variableName = matchResult[1];
      const value = this.get(variableName);
      if (value === undefined) {
        throw new Error(`Variable not defined while resolving ${source}: ${match}`);
      }

      str = str.substr(0, matchResult.index) + value + str.substr(matchResult.index + match.length);
    }
  }

  public resolveObjectValues<T>(
    obj: T,
    matchLeft: string = "\\$\\(",
    matchRight: string = "\\)"
  ): T {
    return this.resolveObjectValuesWithRegExp(obj, this.getVariableRegExp(matchLeft, matchRight));
  }

  private resolveObjectValuesWithRegExp<T>(obj: T, captureVariable: RegExp): T {
    if (typeof obj === "string") {
      return this.resolveStringWithRegExp(obj, captureVariable) as unknown as T;
    }
    if (typeof obj !== "object") {
      return obj;
    }
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return (obj as any[]).map((v) =>
        this.resolveObjectValuesWithRegExp(v, captureVariable)
      ) as unknown as T;
    }

    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = this.resolveObjectValuesWithRegExp((obj as any)[key], captureVariable);
    }
    return result;
  }

  private getVariableRegExp(matchLeft: string, matchRight: string) {
    const key = matchLeft + matchRight;
    let val = regExpCache[key];
    if (val !== undefined) {
      return val;
    }

    val = new RegExp(`${matchLeft}([${allowedVariableName}]+?)${matchRight}`);
    regExpCache[key] = val;
    return val;
  }
}

export class ReflectiveVariableEnv extends VariableEnv {
  public constructor(leftPart: string, rightPart: string) {
    super(undefined);
    const originalData = this.data;
    this.data = new Proxy(this.data, {
      get: (_, propertyKey) => {
        const key = propertyKey as string;
        const val = originalData[key];
        return val === undefined ? `${leftPart}${propertyKey as string}${rightPart}` : val;
      },
    });
  }
}
