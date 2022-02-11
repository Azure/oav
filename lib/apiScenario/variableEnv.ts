import {
  Variable,
  StringVariable,
  SecureStringVariable,
  ObjectVariable,
  SecureObjectVariable,
  VarValue,
  ArrayVariable,
} from "./apiScenarioTypes";
import { jsonPatchApply } from "./diffUtils";

const variableRegex = /\$\(([A-Za-z_][A-Za-z0-9_]*)\)/;
const pathVariableRegex = /\{([A-Za-z_][A-Za-z0-9_]*)\}/;

export class VariableEnv {
  protected baseEnv?: VariableEnv;
  protected data: { [key: string]: Variable } = {};
  protected defaultValue: { [key: string]: Variable } = {};

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

  public setDefaultValue(defaultValue: { [key: string]: Variable }) {
    this.defaultValue = defaultValue;
  }

  public getType(key: string): Variable["type"] | undefined {
    return this.get(key)?.type;
  }

  public getString(key: string): string | undefined {
    const val = this.get(key);
    if (val?.type === "string" || val?.type === "secureString") {
      return val.value;
    }
    return undefined;
  }

  public getObject(key: string): { [key: string]: VarValue } | undefined {
    const val = this.get(key);
    if (val?.type === "object" || val?.type === "secureObject") {
      return val.value;
    }
    return undefined;
  }

  public getArray(key: string): VarValue[] | undefined {
    const val = this.get(key);
    if (val?.type === "array") {
      return val.value;
    }
    return undefined;
  }

  public getBool(key: string): boolean | undefined {
    const val = this.get(key);
    if (val?.type === "bool") {
      return val.value;
    }
    return undefined;
  }

  public getInt(key: string): number | undefined {
    const val = this.get(key);
    if (val && val.type === "int") {
      return val.value;
    }
    return undefined;
  }

  public get(key: string): Variable | undefined {
    return this.data[key] ?? this.baseEnv?.get(key) ?? this.defaultValue[key];
  }

  public getRequiredString(key: string): string {
    const val = this.getRequired(key);
    if (val.type !== "string" && val.type !== "secureString") {
      throw new Error(`Variable ${key} is not a string`);
    }
    return val.value as string;
  }

  public getRequiredObject(key: string): { [key: string]: VarValue } {
    const val = this.getRequired(key);
    if (val.type !== "object" && val.type !== "secureObject") {
      throw new Error(`Variable ${key} is not an object`);
    }
    return val.value as { [key: string]: VarValue };
  }

  public getRequiredArray(key: string): VarValue[] {
    const val = this.getRequired(key);
    if (val.type !== "array") {
      throw new Error(`Variable ${key} is not an array`);
    }
    return val.value as VarValue[];
  }

  public getRequiredBool(key: string): boolean {
    const val = this.getRequired(key);
    if (val.type !== "bool") {
      throw new Error(`Variable ${key} is not a boolean`);
    }
    return val.value as boolean;
  }

  public getRequiredInt(key: string): number {
    const val = this.getRequired(key);
    if (val.type !== "int") {
      throw new Error(`Variable ${key} is not an integer`);
    }
    return val.value as number;
  }

  public getRequired(key: string): Variable {
    const val = this.get(key);
    if (val?.value === undefined) {
      throw new Error(`Variable is required but is not found in VariableEnv: ${key}`);
    }
    return val;
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
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value);
    }
  }

  public setBatchEnv(environmentVariables: { [key: string]: string }) {
    for (const [key, value] of Object.entries(environmentVariables)) {
      const varType = this.getType(key) ?? "string";
      if (varType !== "string" && varType !== "secureString") {
        throw new Error(`String value is not assignable to variable ${key} of type ${varType}`);
      }
      this.set(key, {
        type: varType,
        value,
      });
    }
  }

  public resolve() {
    this.baseEnv?.resolve();
    for (const key of Object.keys(this.data)) {
      const val = this.data[key];
      switch (val.type) {
        case "string":
        case "secureString":
          this.doResolveStringVariable(key, val);
          break;
        case "object":
        case "secureObject":
        case "array":
          this.doResolveObjectVariable(key, val);
          break;
        case "bool":
        case "int":
        default:
          break;
      }
    }
  }

  private doResolveStringVariable(key: string, val: StringVariable | SecureStringVariable) {
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
  }

  private doResolveObjectVariable(
    key: string,
    val: ObjectVariable | SecureObjectVariable | ArrayVariable
  ) {
    if (val.value) {
      val.value = this.resolveObjectValues(val.value);
    } else if (val.patches) {
      const refVal = this.baseEnv?.get(key);
      if (
        refVal &&
        refVal.type !== "object" &&
        refVal.type !== "secureObject" &&
        refVal.type !== "array"
      ) {
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
  }

  public resolveString(source: string, isPathVariable?: boolean): string {
    return this.resolveStringWithRegex(source, isPathVariable || false) as string;
  }

  private resolveStringWithRegex(
    source: string,
    isPathVariable: boolean
  ): string | number | boolean {
    const regex = isPathVariable ? pathVariableRegex : variableRegex;
    if (regex.test(source)) {
      const globalRegex = new RegExp(regex, "g");
      const replaceArray: Array<[number, number, string]> = [];
      let match;
      while ((match = globalRegex.exec(source))) {
        const variable = this.getRequired(match[1]);
        if (
          variable.type !== "string" &&
          variable.type !== "secureString" &&
          variable.type !== "int" &&
          variable.type !== "bool"
        ) {
          throw new Error(`Variable type is not string, int, bool: ${match[1]}`);
        }
        if (match.index === 0 && match[0].length === source.length) {
          return variable.value!;
        }
        replaceArray.push([match.index, match.index + match[0].length, variable.value!.toString()]);
      }
      let r;
      while ((r = replaceArray.pop())) {
        source = source.substring(0, r[0]) + r[2] + source.substring(r[1]);
      }
    }
    return source;
  }

  public resolveObjectValues<T>(obj: T): T {
    if (typeof obj === "string") {
      return this.resolveStringWithRegex(obj, false) as unknown as T;
    }
    return this.resolveObjectValuesWithRegex(obj);
  }

  private resolveObjectValuesWithRegex<T>(obj: T): T {
    if (typeof obj !== "object") {
      return obj;
    }
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return (obj as any[]).map((v) => {
        if (typeof v === "string") {
          return this.resolveStringWithRegex(v, false);
        }
        return this.resolveObjectValuesWithRegex(v);
      }) as unknown as T;
    }

    const result: any = {};
    for (const key of Object.keys(obj)) {
      if (typeof (obj as any)[key] === "string") {
        result[key] = this.resolveStringWithRegex((obj as any)[key], false);
      } else {
        result[key] = this.resolveObjectValuesWithRegex((obj as any)[key]);
      }
    }
    return result;
  }
}

export class ReflectiveVariableEnv extends VariableEnv {
  public constructor(leftPart: string, rightPart: string) {
    super(undefined);
    const originalData = this.data;
    this.data = new Proxy(this.data, {
      get: (_, propertyKey): Variable => {
        const key = propertyKey as string;
        const val = originalData[key];
        return val === undefined
          ? { type: "string", value: `${leftPart}${propertyKey as string}${rightPart}` }
          : val;
      },
    });
  }
}
