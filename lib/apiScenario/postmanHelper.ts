import * as jsonPointer from "json-pointer";
import { Event, EventDefinition, Item, ItemDefinition, ScriptDefinition } from "postman-collection";
import { getRandomString } from "../util/utils";
import { ArmTemplate, StepResponseAssertion } from "./apiScenarioTypes";

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

export function createEvent(
  listen: "prerequest" | "test",
  script: ScriptDefinition,
  additionalDefinition?: EventDefinition
): Event {
  return new Event({
    id: getRandomString(),
    listen,
    script,
    ...additionalDefinition,
  });
}

export function createScript(script: string): ScriptDefinition {
  return {
    id: getRandomString(),
    type: "text/javascript",
    exec: script,
  };
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

export function generateScript(parameter: TestScriptParameter): ScriptDefinition {
  const script: string[] = [];
  script.push(`pm.test("${parameter.name}", function() {`);
  if (parameter.types.includes("DetailResponseLog")) {
    script.push("console.log(pm.response.text());");
  }
  if (parameter.types.includes("StatusCodeAssertion")) {
    script.push("pm.response.to.be.success;");
  }
  if (parameter.types.includes("OverwriteVariables") && parameter.variables) {
    for (const [k, v] of parameter.variables) {
      const segments = parseJsonPointer(v);
      if (segments.length === 0) {
        script.push(`pm.environment.set("${k}", pm.response.json());`);
      } else {
        script.push(
          `pm.environment.set("${k}", _.get(pm.response.json(), ${JSON.stringify(segments)}));`
        );
      }
    }
  }
  if (parameter.types.includes("ARMDeploymentStatusAssertion")) {
    script.push(
      'pm.expect(pm.response.json().status).to.be.oneOf(["Succeeded", "Accepted", "Running", "Ready", "Creating", "Created", "Deleting", "Deleted", "Canceled", "Updating"]);'
    );
  }
  if (parameter.types.includes("ExtractARMTemplateOutput") && parameter.armTemplate?.outputs) {
    for (const key of Object.keys(parameter.armTemplate.outputs)) {
      script.push(
        `pm.environment.set("${key}", pm.response.json().properties.outputs.${key}.value);`
      );
    }
  }
  if (parameter.types.includes("ResponseDataAssertion") && parameter.responseAssertion) {
    script.push(generateResponseDataAssertionScript(parameter.responseAssertion));
  }
  script.push("});");
  return createScript(script.join("\n"));
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
  {
    key: "x_bearer_token",
    type: "secret",
  },
  {
    key: "x_bearer_token_expires_on",
  },
  {
    key: "x_polling_url",
  },
  {
    key: "x_retry_after",
    value: "10",
  },
];

export function generateAuthScript(baseUrl: string): ScriptDefinition {
  const script = `
if (pm.variables.get("x_enable_auth") !== "true") {
    return;
}
let vars = ["client_id", "client_secret", "tenantId", "subscriptionId"];
vars.forEach(function (item, index, array) {
    pm.expect(
        pm.variables.get(item),
        item + " variable not set"
    ).to.not.be.undefined;
    pm.expect(pm.variables.get(item), item + " variable not set").to.not.be.empty;
});
if (
    !pm.collectionVariables.get("x_bearer_token") ||
    Date.now() >
    new Date(pm.collectionVariables.get("x_bearer_token_expires_on") * 1000)
) {
    pm.sendRequest(
        {
            url:
                "https://login.microsoftonline.com/" +
                pm.variables.get("tenantId") +
                "/oauth2/token",
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
                    { key: "resource", value: "${baseUrl}", disabled: false },
                ],
            },
        },
        function (err, res) {
            if (err) {
                console.log(err);
            } else {
                let resJson = res.json();
                pm.collectionVariables.set(
                    "x_bearer_token_expires_on",
                    resJson.expires_on
                );
                pm.collectionVariables.set("x_bearer_token", resJson.access_token);
            }
        }
    );
}`;
  return createScript(script);
}
