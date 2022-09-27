import * as jsonPointer from "json-pointer";
import {
  Collection,
  Event,
  EventDefinition,
  EventList,
  Item,
  ItemDefinition,
  ItemGroup,
  ItemGroupDefinition,
} from "postman-collection";
import { getRandomString } from "../util/utils";
import { ArmTemplate, StepResponseAssertion } from "./apiScenarioTypes";

export const PREPARE_FOLDER = "__Prepare__";
export const CLEANUP_FOLDER = "__CleanUp__";

function parseJsonPointer(jsonPointer: string): string[] {
  if (jsonPointer === "") {
    return [];
  }
  return jsonPointer
    .substring(1)
    .split(/\//)
    .map((seg) => seg.replace(/~1/g, "/").replace(/~0/g, "~"));
}

interface TestScriptParameter {
  name: string;
  types: TestScriptType[];
  variables?: Map<string, string>;
  armTemplate?: ArmTemplate;
  responseAssertion?: StepResponseAssertion;
}

export type TestScriptType =
  | "StatusCodeAssertion"
  | "ResponseDataAssertion"
  | "DetailResponseLog"
  | "OverwriteVariables"
  | "ARMDeploymentStatusAssertion"
  | "ExtractARMTemplateOutput";

export function createItem(definition?: ItemDefinition): Item {
  return new Item({
    id: getRandomString(),
    ...definition,
  });
}

export function addItemGroup(
  target: Collection,
  definition?: ItemGroupDefinition
): ItemGroup<Item> {
  const itemGroup = new ItemGroup<Item>({
    id: getRandomString(),
    ...definition,
  });
  target.items.add(itemGroup);
  return itemGroup;
}

export function addEvent(
  target: EventList,
  listen: "prerequest" | "test",
  script: string | string[],
  additionalDefinition?: EventDefinition
) {
  target.add(
    new Event({
      id: getRandomString(),
      listen,
      script: {
        id: getRandomString(),
        type: "text/javascript",
        exec: script,
      },
      ...additionalDefinition,
    })
  );
}

function generateResponseDataAssertionScript(responseAssertion: StepResponseAssertion): string {
  let ret = "";
  const addBodyAssertion = (segments: string[], exp: string) => {
    ret += `pm.expect(_.get(pm.response.json(), ${JSON.stringify(segments)})).${exp};\n`;
  };

  const addHeaderAssertion = (key: string, exp: string) => {
    ret += `pm.expect(pm.response.headers.get("${key}")).${exp};\n`;
  };

  for (const [statusCode, v] of Object.entries(responseAssertion)) {
    ret += `if (pm.response.code === ${statusCode}) {\n`;
    if (Array.isArray(v)) {
      for (const assertion of v) {
        const exp = assertion.value
          ? `to.deep.eql(${JSON.stringify(assertion.value)})`
          : assertion.expression!;

        const pathSegments = jsonPointer.parse(assertion.test);
        const type = pathSegments.shift();

        if (type === "body") {
          addBodyAssertion(pathSegments, exp);
        } else {
          addHeaderAssertion(pathSegments[0], exp);
        }
      }
    } else {
      Object.entries(v.headers || {}).forEach(([k, v]) => {
        addHeaderAssertion(k, `to.eql(${JSON.stringify(v)})`);
      });

      if (v.body) {
        jsonPointer.walk(v.body, (value, path) => {
          addBodyAssertion(jsonPointer.parse(path), `to.eql(${JSON.stringify(value)})`);
        });
      }
    }
    ret += "}\n";
  }
  return ret;
}

export function appendScripts(scripts: string[], parameter: TestScriptParameter) {
  scripts.push(`pm.test("${parameter.name}", function() {`);
  if (parameter.types.includes("DetailResponseLog")) {
    scripts.push("console.log(pm.response.text());");
  }
  if (parameter.types.includes("StatusCodeAssertion")) {
    scripts.push("pm.response.to.be.success;");
  }
  if (parameter.types.includes("OverwriteVariables") && parameter.variables) {
    for (const [k, v] of parameter.variables) {
      const segments = parseJsonPointer(v);
      if (segments.length === 0) {
        scripts.push(`pm.environment.set("${k}", pm.response.json());`);
      } else {
        scripts.push(
          `pm.environment.set("${k}", _.get(pm.response.json(), ${JSON.stringify(segments)}));`
        );
      }
    }
  }
  if (parameter.types.includes("ARMDeploymentStatusAssertion")) {
    scripts.push(
      'pm.expect(pm.response.json().status).to.be.oneOf(["Succeeded", "Accepted", "Running", "Ready", "Creating", "Created", "Deleting", "Deleted", "Canceled", "Updating"]);'
    );
  }
  if (parameter.types.includes("ExtractARMTemplateOutput") && parameter.armTemplate?.outputs) {
    for (const key of Object.keys(parameter.armTemplate.outputs)) {
      scripts.push(
        `pm.environment.set("${key}", pm.response.json().properties.outputs.${key}.value);`
      );
    }
  }
  if (parameter.types.includes("ResponseDataAssertion") && parameter.responseAssertion) {
    scripts.push(generateResponseDataAssertionScript(parameter.responseAssertion));
  }
  scripts.push("});");
}

export const reservedCollectionVariables = [
  {
    key: "subscriptionId",
  },
  {
    key: "resourceGroupName",
  },
  {
    key: "location",
  },
  {
    key: "client_id",
  },
  {
    key: "client_secret",
    type: "secret",
  },
  {
    key: "tenantId",
  },
  {
    key: "x_enable_auth",
    value: "true",
  },
];

export function generateAuthScript(scope: string, tokenName: string): string {
  const script = `
if (pm.variables.get("x_enable_auth") !== "true") {
    return;
}
if (
    !pm.variables.get("${tokenName}") ||
    Date.now() >
    new Date(pm.variables.get("${tokenName}_expires_on") * 1000)
) {
    let vars = ["client_id", "client_secret", "tenantId"];
    vars.forEach(function (item, index, array) {
        pm.expect(
            pm.variables.get(item),
            item + " variable not set"
        ).to.not.be.undefined;
        pm.expect(pm.variables.get(item), item + " variable not set").to.not.be.empty;
    });
    pm.sendRequest(
        {
            url:
                "https://login.microsoftonline.com/" +
                pm.variables.get("tenantId") +
                "/oauth2/v2.0/token",
            method: "POST",
            header: "Content-Type: application/x-www-form-urlencoded",
            body: {
                mode: "urlencoded",
                urlencoded: [
                    { key: "grant_type", value: "client_credentials", disabled: false },
                    {
                        key: "client_id",
                        value: pm.variables.get("client_id"),
                        disabled: false,
                    },
                    {
                        key: "client_secret",
                        value: pm.variables.get("client_secret"),
                        disabled: false,
                    },
                    { key: "scope", value: "${scope}", disabled: false },
                ],
            },
        },
        function (err, res) {
            if (err) {
                console.log(err);
            } else {
                let resJson = res.json();
                pm.variables.set(
                    "${tokenName}_expires_on",
                    resJson.expires_in + Math.floor(Date.now() / 1000)
                );
                pm.variables.set("${tokenName}", resJson.access_token);
            }
        }
    );
}`;
  return script;
}
