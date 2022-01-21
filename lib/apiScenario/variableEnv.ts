import { Variable } from "./apiScenarioTypes";
import { jsonPatchApply } from "./diffUtils";

const variableRegex = /\$\(([A-Za-z_][A-Za-z0-9_]*)\)/;
const pathVariableRegex = /\{([A-Za-z_][A-Za-z0-9_]*)\}/;

export class VariableEnv {
  protected baseEnv?: VariableEnv;
  protected data: { [key: string]: Variable } = {};

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

  public get(key: string): Variable | undefined {
    let val = this.data[key];
    if (val !== undefined) {
      switch (val.type) {
        case "string":
        case "secureString":
          if (val.value && variableRegex.test(val.value)) {
            const globalRegex = new RegExp(variableRegex, "g");
            const replaceArray: Array<[number, number, string | undefined]> = [];
            let match;
            while ((match = globalRegex.exec(val.value))) {
              const refKey = match[1];
              const refVal = refKey === key ? this.baseEnv?.get(key) ?? val : this.get(refKey);
              if (refVal && refVal.type !== "string" && refVal.type !== "secureString") {
                throw new Error(`Invalid reference variable type: ${refKey}`);
              }
              if (refVal?.type === "secureString") {
                val.type = "secureString";
              }
              replaceArray.push([match.index, match.index + match[0].length, refVal?.value]);
            }
            let r;
            while ((r = replaceArray.pop())) {
              if (r[2] !== undefined) {
                val.value = val.value.substring(0, r[0]) + r[2] + val.value.substring(r[1]);
              }
            }
          }
          break;
        case "object":
        case "secureObject":
        case "array":
          if (val.value) {
            val.value = this.resolveObjectValues(val.value);
          } else if (val.patches) {
            const refVal = this.baseEnv?.get(key);
            if (refVal && refVal.type !== "object" && refVal.type !== "secureObject") {
              throw new Error(`Invalid reference variable type: ${key}`);
            }
            if (refVal?.type === "secureObject") {
              val.type = "secureObject";
            }
            if (refVal?.value) {
              val.value = refVal.value;
              val.value = jsonPatchApply(val.value, val.patches);
            }
          }
          break;
        case "bool":
        case "int":
        default:
          break;
      }
      return val;
    }
    return this.baseEnv?.get(key);
  }

  public getRequired(key: string): Variable {
    const result = this.get(key);
    if (result?.value === undefined) {
      throw new Error(`Variable is required but is not found in VariableEnv: ${key}`);
    }
    return result;
  }

  public set(key: string, value: Variable) {
    this.data[key] = value;
  }

  public output(key: string, value: Variable) {
    this.baseEnv?.set(key, value);
  }

  public setBatch(values: { [key: string]: Variable }) {
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
    const regex = isPathVariable ? pathVariableRegex : variableRegex;
    if (regex.test(source)) {
      const globalRegex = new RegExp(regex, "g");
      const replaceArray: Array<[number, number, string]> = [];
      let match;
      while ((match = globalRegex.exec(source))) {
        const variable = this.getRequired(match[1]);
        if (variable.type !== "string" && variable.type !== "secureString") {
          throw new Error(`Variable type is not string: ${match[1]}`);
        }
        replaceArray.push([match.index, match.index + match[0].length, variable.value!]);
      }
      let r;
      while ((r = replaceArray.pop())) {
        source = source.substring(0, r[0]) + r[2] + source.substring(r[1]);
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
