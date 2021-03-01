interface ScriptTemplate {
  text: string;
}

const StatusCodeAssertion: ScriptTemplate = {
  text: `pm.expect(pm.response.code).to.be.oneOf([200, 201, 202]);`,
};

const DetailResponseLog: ScriptTemplate = {
  text: `
  console.log(pm.response.text())
  console.log(pm.response.code)
  console.log(pm.response.headers)
  `,
};

interface TestScriptParameter {
  name: string;
  types: TestScriptType[];
  variables?: Map<string, string>;
}

export type TestScriptType =
  | "StatusCodeAssertion"
  | "ResponseDataAssertion"
  | "DetailResponseLog"
  | "OverwriteVariables";

export class PostmanTestScript {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor() {}

  public generateScript(parameter: TestScriptParameter): string {
    const begin = `pm.test("${parameter.name}", function() {`;
    const end = "});";
    let ret = begin;
    if (parameter.types.includes("DetailResponseLog")) {
      ret += DetailResponseLog.text;
    }
    if (parameter.types.includes("StatusCodeAssertion")) {
      ret += StatusCodeAssertion.text;
    }
    if (parameter.types.includes("OverwriteVariables")) {
      ret += this.generateOverWriteVariablesScript(parameter.variables!);
    }
    return ret + end;
  }

  private generateOverWriteVariablesScript(variables: Map<string, string>): string {
    let ret = "";
    for (const [k, v] of variables) {
      ret += `pm.environment.set("${k}", pm.response.json().${v})`;
    }
    return ret;
  }
}
