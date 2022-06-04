import { Event, EventDefinition, Item, ItemDefinition, ScriptDefinition } from "postman-collection";
import { getRandomString } from "../util/utils";
import { ArmTemplate } from "./apiScenarioTypes";

interface ScriptTemplate {
  text: string;
}

const StatusCodeAssertion: ScriptTemplate = {
  text: `pm.response.to.be.success;\n`,
};

const ARMDeploymentStatusAssertion: ScriptTemplate = {
  text: `pm.expect(pm.response.json().status).to.be.oneOf(["Succeeded", "Accepted", "Running", "Ready", "Creating", "Created", "Deleting", "Deleted", "Canceled", "Updating"]);\n`,
};

const DetailResponseLog: ScriptTemplate = {
  text: `console.log(pm.response.text());\n
  `,
};

const GetObjectValueByJsonPointer: ScriptTemplate = {
  text: `const getValueByJsonPointer = (obj, pointer) => {
    var refTokens = Array.isArray(pointer) ? pointer : parse(pointer);

    for (var i = 0; i < refTokens.length; ++i) {
        var tok = refTokens[i];
        if (!(typeof obj == 'object' && tok in obj)) {
            throw new Error('Invalid reference token: ' + tok);
        }
        obj = obj[tok];
    }
    return obj;
  };

  const jsonPointerUnescape = (str)=>{
    return str.replace(/~1/g, '/').replace(/~0/g, '~');
  };

  const parse = (pointer) => {
    if (pointer === "") {
      return [];
    }
    if (pointer.charAt(0) !== "/") {
      throw new Error("Invalid JSON pointer: " + pointer);
    }
    return pointer.substring(1).split(/\\//).map(jsonPointerUnescape);
  };

  `,
};

interface TestScriptParameter {
  name: string;
  types: TestScriptType[];
  variables?: Map<string, string>;
  armTemplate?: ArmTemplate;
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

export function generateScript(parameter: TestScriptParameter): ScriptDefinition {
  const script = `pm.test("${parameter.name}", function() {
    ${[
      parameter.types.includes("DetailResponseLog") ? DetailResponseLog.text : "",
      parameter.types.includes("StatusCodeAssertion") ? StatusCodeAssertion.text : "",
      parameter.types.includes("OverwriteVariables")
        ? generateOverWriteVariablesScript(parameter.variables!)
        : "",
      parameter.types.includes("ARMDeploymentStatusAssertion")
        ? ARMDeploymentStatusAssertion.text
        : "",
      parameter.types.includes("ExtractARMTemplateOutput")
        ? generateARMTemplateOutputScript(parameter.armTemplate!)
        : "",
    ].join("")}
  });
  `;
  return createScript(script);
}

function generateOverWriteVariablesScript(variables: Map<string, string>): string {
  let ret = GetObjectValueByJsonPointer.text;
  for (const [k, v] of variables) {
    ret += `pm.environment.set("${k}", getValueByJsonPointer(pm.response.json(), "${v}"));`;
  }
  return ret;
}

function generateARMTemplateOutputScript(armTemplate: ArmTemplate): string {
  let ret = "";
  for (const key of Object.keys(armTemplate.outputs || {})) {
    ret += `pm.environment.set("${key}", pm.response.json().properties.outputs.${key}.value);\n`;
  }
  return ret;
}

export const reservedVariables = [
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
  const script = `if (pm.variables.get("x_enable_auth") !== "true") {
    console.log("Auth disabled");
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
}
`;
  return createScript(script);
}
