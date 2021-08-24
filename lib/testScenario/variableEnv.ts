const variableRegex = /\$\(([A-Za-z_][A-Za-z0-9_]*)\)/g;
const pathVariableRegex = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
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

  public resolveString(source: string, isPathVariable?: boolean): string {
    return this.resolveStringWithRegex(source, isPathVariable || false);
  }

  private resolveStringWithRegex(source: string, isPathVariable: boolean): string {
    let match;
    const regex = isPathVariable ? pathVariableRegex : variableRegex;
    while (regex.test(source)) {
      const current = source;
      while ((match = regex.exec(source))) {
        source =
          source.substring(0, match.index) +
          this.getRequired(match[1]) +
          source.substring(match.index + match[0].length);
      }
      if (current === source) {
        break;
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
