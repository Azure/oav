const variableRegex = /\$\(([A-Za-z_][A-Za-z0-9_]*)\)/;
const pathVariableRegex = /\{([A-Za-z_][A-Za-z0-9_]*)\}/;

export class VariableEnv {
  protected baseEnv?: VariableEnv;
  protected data: { [key: string]: string } = {};

  public constructor(baseEnv?: VariableEnv) {
    if (baseEnv !== undefined) {
      this.baseEnv = baseEnv;
    }
  }

  public clear() {
    for (const key of Object.keys(this.data)) {
      delete this.data[key];
    }
  }

  public setBaseEnv(baseEnv: VariableEnv) {
    this.baseEnv = baseEnv;
  }

  public get(key: string): string | undefined {
    let val = this.data[key];
    if (val !== undefined) {
      if (variableRegex.test(val)) {
        const globalRegex = new RegExp(variableRegex, "g");
        const replaceArray: Array<[number, number, string | undefined]> = [];
        let match;
        while ((match = globalRegex.exec(val))) {
          const refKey = match[1];
          const refVal = refKey === key ? this.baseEnv?.get(key) ?? val : this.get(refKey);
          replaceArray.push([match.index, match.index + match[0].length, refVal]);
        }
        let pair;
        while ((pair = replaceArray.pop())) {
          if (pair[2] !== undefined) {
            val = val.substring(0, pair[0]) + pair[2] + val.substring(pair[1]);
          }
        }
      }
      return val;
    }
    return this.baseEnv?.get(key);
  }

  public getRequired(key: string): string {
    const result = this.get(key);
    if (result === undefined) {
      throw new Error(`Variable is required but is not found in VariableEnv: ${key}`);
    }
    return result;
  }

  public set(key: string, value: string) {
    this.data[key] = value;
  }

  public output(key: string, value: string) {
    this.baseEnv?.set(key, value);
  }

  public setBatch(values: { [key: string]: string }) {
    if (values === undefined) {
      return;
    }
    for (const key of Object.keys(values)) {
      this.set(key, values[key]);
    }
  }

  public resolve() {
    for (const key of Object.keys(this.data)) {
      this.set(key, this.getRequired(key));
    }
  }

  public resolveString(source: string, isPathVariable?: boolean): string {
    return this.resolveStringWithRegex(source, isPathVariable || false);
  }

  private resolveStringWithRegex(source: string, isPathVariable: boolean): string {
    let match;
    const regex = isPathVariable ? pathVariableRegex : variableRegex;
    if (regex.test(source)) {
      const globalRegex = new RegExp(regex, "g");
      while ((match = globalRegex.exec(source))) {
        source =
          source.substring(0, match.index) +
          this.getRequired(match[1]) +
          source.substring(match.index + match[0].length);
      }
    }
    return source;
  }

  public resolveObjectValues<T>(obj: T): T {
    return this.resolveObjectValuesWithRegex(obj);
  }

  private resolveObjectValuesWithRegex<T>(obj: T): T {
    if (typeof obj === "string") {
      return this.resolveStringWithRegex(obj, false) as unknown as T;
    }
    if (typeof obj !== "object") {
      return obj;
    }
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return (obj as any[]).map((v) => this.resolveObjectValuesWithRegex(v)) as unknown as T;
    }

    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = this.resolveObjectValuesWithRegex((obj as any)[key]);
    }
    return result;
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
