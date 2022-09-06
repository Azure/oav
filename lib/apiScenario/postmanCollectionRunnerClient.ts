import {
  Collection,
  Item,
  ItemDefinition,
  ItemGroup,
  Request,
  RequestAuth,
  RequestBody,
  RequestBodyDefinition,
  Url,
  Variable,
  VariableScope,
} from "postman-collection";
import {
  ApiScenarioClientRequest,
  ApiScenarioRunnerClient,
  ArmDeployment,
  Scope,
} from "./apiScenarioRunner";
import {
  ArmTemplate,
  Authentication,
  Scenario,
  ScenarioDefinition,
  StepArmTemplate,
  StepResponseAssertion,
  StepRestCall,
} from "./apiScenarioTypes";
import { generatedGet, generatedPostmanItem } from "./defaultNaming";
import * as PostmanHelper from "./postmanHelper";
import { VariableEnv } from "./variableEnv";

export interface PostmanCollectionRunnerClientOption {
  collectionName?: string;
  runId: string;
  armEndpoint: string;
  testProxy?: string;
  verbose?: boolean;
  skipAuth?: boolean;
  skipArmCall?: boolean;
  skipLroPoll?: boolean;
}

const ARM_API_VERSION = "2020-06-01";

export class PostmanCollectionRunnerClient implements ApiScenarioRunnerClient {
  private opts: PostmanCollectionRunnerClientOption;
  private collection: Collection;
  private prepareStepsFolder: ItemGroup<Item>;
  private cleanUpStepsFolder: ItemGroup<Item>;
  private scenarioFolder: ItemGroup<Item>;
  private runtimeEnv: VariableScope;
  private aadTokenMap = new Map<string, string>();

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(opts: PostmanCollectionRunnerClientOption) {
    this.opts = opts;
  }

  private checkTokenMap(auth: Authentication): string | undefined {
    if (auth.type === "AzureAD" && auth.audience && !this.aadTokenMap.has(auth.audience)) {
      this.aadTokenMap.set(auth.audience, `x_bearer_token_${this.aadTokenMap.size}`);
      return this.aadTokenMap.get(auth.audience);
    }
    return undefined;
  }

  public async provisionScope(scenarioDef: ScenarioDefinition, scope: Scope): Promise<void> {
    this.collection = new Collection({
      info: {
        id: this.opts.runId,
        name: this.opts.collectionName,
      },
    });
    // TODO: figure out what's this for
    this.collection.describe(
      JSON.stringify({
        apiScenarioFilePath: scenarioDef._filePath,
        // apiScenarioName: scenario.scenario,
        swaggerFilePaths: scenarioDef._swaggerFilePaths,
      })
    );

    scope.env.resolve();

    this.runtimeEnv = new VariableScope({});
    this.runtimeEnv.set("tenantId", scope.env.get("tenantId")?.value, "string");
    this.runtimeEnv.set("client_id", scope.env.get("client_id")?.value, "string");
    this.runtimeEnv.set("client_secret", scope.env.get("client_secret")?.value, "string");
    this.runtimeEnv.set("subscriptionId", scope.env.get("subscriptionId")?.value, "string");
    this.runtimeEnv.set("resourceGroupName", scope.env.get("resourceGroupName")?.value, "string");
    this.runtimeEnv.set("location", scope.env.get("location")?.value, "string");
  }

  public async prepareScenario(scenario: Scenario, env: VariableEnv): Promise<void> {
    const tokenName = this.checkTokenMap(scenario.authentication);

    this.scenarioFolder = PostmanHelper.createItemGroup({
      name: scenario.scenario,
      description: scenario.description,
    });

    this.collection.items.add(this.scenarioFolder);

    if (tokenName) {
      this.collection.auth = new RequestAuth({
        type: "bearer",
        bearer: [
          {
            key: "token",
            value: `{{${tokenName}}}`,
            type: "string",
          },
        ],
      });
      this.collection.events.add(
        PostmanHelper.createEvent(
          "prerequest",
          PostmanHelper.generateAuthScript(scenario.authentication.audience!, tokenName)
        )
      );
    }

    env.resolve();

    for (const [name, variable] of env.getVariables()) {
      if (!this.runtimeEnv.has(name) && !this.collection.variables.has(name)) {
        if (variable.type === "secureString" || variable.type === "secureObject") {
          this.runtimeEnv.set(name, variable.value, "secret");
          this.collection.variables.add(new Variable({ key: name, type: "secret" }));
        } else {
          this.collection.variables.add(
            new Variable({
              key: name,
              value: variable.value,
            })
          );
        }
      }
    }

    PostmanHelper.reservedCollectionVariables.forEach((variable) => {
      if (!this.collection.variables.has(variable.key)) {
        if (this.opts.skipAuth && variable.key === "x_enable_auth") {
          this.collection.variables.add(
            new Variable({
              key: variable.key,
              value: "false",
            })
          );
        } else {
          this.collection.variables.add(new Variable(variable));
        }
      }
    });

    if (this.opts.testProxy) {
      this.startTestProxyRecording();
    }
  }

  public outputCollection(): [Collection, VariableScope] {
    if (this.opts.testProxy) {
      this.stopTestProxyRecording();
    }
    return [this.collection, this.runtimeEnv];
  }

  private startTestProxyRecording() {
    const item = this.addNewItem(
      "Prepare",
      {
        name: "startTestProxyRecording",
        request: {
          url: `${this.opts.testProxy}/record/start`,
          method: "POST",
          body: {
            mode: "raw",
            raw: `{"x-recording-file": "./recordings/${this.opts.collectionName}_${this.opts.runId}.json"}`,
          },
        },
      },
      false
    );
    item.events.add(
      PostmanHelper.createEvent(
        "test",
        PostmanHelper.createScript(
          `
pm.test("Started TestProxy recording", function() {
    pm.response.to.be.success;
    pm.response.to.have.header("x-recording-id");
    pm.collectionVariables.set("x_recording_id", pm.response.headers.get("x-recording-id"));
});`
        )
      )
    );
    this.prepareStepsFolder.items.add(item);
  }

  private stopTestProxyRecording() {
    const item = this.addNewItem(
      "CleanUp",
      {
        name: "stopTestProxyRecording",
        request: {
          url: `${this.opts.testProxy}/record/stop`,
          method: "POST",
        },
      },
      false
    );
    item.request.addHeader({
      key: "x-recording-id",
      value: "{{x_recording_id}}",
    });
    item.events.add(
      PostmanHelper.createEvent(
        "test",
        PostmanHelper.createScript(
          `
pm.test("Stopped TestProxy recording", function() {
    pm.response.to.be.success;
});
`
        )
      )
    );
  }

  private addNewItem(
    itemType: "Prepare" | "CleanUp" | "Scenario" | "Blank",
    definition?: ItemDefinition,
    checkTestProxy: boolean = true
  ): Item {
    const item = PostmanHelper.createItem(definition);
    if (checkTestProxy && this.opts.testProxy) {
      item.request.addHeader({
        key: "x-recording-upstream-base-uri",
        value: this.opts.armEndpoint,
      });
      item.request.addHeader({ key: "x-recording-id", value: "{{x_recording_id}}" });
      item.request.addHeader({ key: "x-recording-mode", value: "record" });
    }

    switch (itemType) {
      case "Prepare":
        if (this.prepareStepsFolder === undefined) {
          this.prepareStepsFolder = PostmanHelper.createItemGroup({
            name: "__Prepare__",
          });
          this.collection.items.add(this.prepareStepsFolder);
        }
        this.prepareStepsFolder.items.add(item);
        break;
      case "CleanUp":
        if (this.cleanUpStepsFolder === undefined) {
          this.cleanUpStepsFolder = PostmanHelper.createItemGroup({
            name: "__CleanUp__",
          });
          this.collection.items.add(this.cleanUpStepsFolder);
        }
        this.cleanUpStepsFolder.items.add(item);
        break;
      case "Scenario":
        if (this.scenarioFolder === undefined) {
          throw new Error("Scenario folder is not initialized");
        }
        this.scenarioFolder.items.add(item);
        break;
      case "Blank":
        break;
    }

    return item;
  }

  public async createResourceGroup(
    subscriptionId: string,
    resourceGroupName: string,
    location: string
  ): Promise<void> {
    if (this.opts.skipArmCall) return;

    const item = this.addNewItem("Prepare", {
      name: "createResourceGroup",
    });

    item.request.method = "PUT";
    item.request.url = new Url({
      host: this.opts.testProxy ?? this.opts.armEndpoint,
      path: "/subscriptions/:subscriptionId/resourcegroups/:resourceGroupName",
      variable: [
        {
          key: "subscriptionId",
          value: "{{subscriptionId}}",
        },
        {
          key: "resourceGroupName",
          value: "{{resourceGroupName}}",
        },
      ],
      query: [
        {
          key: "api-version",
          value: ARM_API_VERSION,
        },
      ],
    });
    item.request.body = new RequestBody({
      mode: "raw",
      raw: '{"location":"{{location}}"}',
    });

    item.description = JSON.stringify({ type: "prepare" });

    item.request.addHeader({ key: "Content-Type", value: "application/json" });

    this.addTestScript(item);

    this.runtimeEnv.set("subscriptionId", subscriptionId, "string");
    this.runtimeEnv.set("resourceGroupName", resourceGroupName, "string");
    this.runtimeEnv.set("location", location, "string");
  }

  public async deleteResourceGroup(
    _subscriptionId: string,
    _resourceGroupName: string
  ): Promise<void> {
    if (this.opts.skipArmCall) return;

    const item = this.addNewItem("CleanUp", {
      name: "deleteResourceGroup",
    });
    item.request.method = "DELETE";
    item.request.url = new Url({
      host: this.opts.testProxy ?? this.opts.armEndpoint,
      path: "/subscriptions/:subscriptionId/resourcegroups/:resourceGroupName",
      variable: [
        {
          key: "subscriptionId",
          value: "{{subscriptionId}}",
        },
        {
          key: "resourceGroupName",
          value: "{{resourceGroupName}}",
        },
      ],
      query: [
        {
          key: "api-version",
          value: ARM_API_VERSION,
        },
      ],
    });

    item.request.addHeader({ key: "Content-Type", value: "application/json" });

    item.events.add(
      PostmanHelper.createEvent(
        "test",
        PostmanHelper.generateScript({
          name: "response code should be 2xx",
          types: ["StatusCodeAssertion"],
        })
      )
    );

    this.addAsLongRunningOperationItem(this.cleanUpStepsFolder, item);
  }

  public async sendRestCallRequest(
    clientRequest: ApiScenarioClientRequest,
    step: StepRestCall,
    env: VariableEnv
  ): Promise<void> {
    const item = this.addNewItem(
      step.isPrepareStep ? "Prepare" : step.isCleanUpStep ? "CleanUp" : "Scenario",
      {
        name: step.step,
        request: {
          method: clientRequest.method,
          url: clientRequest.path,
          body: clientRequest.body
            ? {
                mode: "raw",
                raw: JSON.stringify(convertPostmanFormat(clientRequest.body), null, 2),
              }
            : undefined,
        },
      }
    );

    const itemGroup = step.isPrepareStep
      ? this.prepareStepsFolder
      : step.isCleanUpStep
      ? this.cleanUpStepsFolder
      : this.scenarioFolder;

    item.description = step.operation.operationId;

    item.request.url = new Url({
      host: this.opts.testProxy ?? this.opts.armEndpoint,
      path: covertToPostmanVariable(clientRequest.path, true),
      variable: Object.entries(clientRequest.pathVariables ?? {}).map(([key, value]) => ({
        key,
        value: convertPostmanFormat(value),
      })),
      query: Object.entries(clientRequest.query).map(([key, value]) => ({
        key,
        value: convertPostmanFormat(value),
      })),
    });

    item.request.addHeader({ key: "Content-Type", value: "application/json" });
    Object.entries(clientRequest.headers).forEach(([key, value]) => {
      item.request.addHeader({ key, value: convertPostmanFormat(value) });
    });

    env.resolve();

    step._resolvedParameters = env.resolveObjectValues(step.parameters);

    if (Object.keys(step.variables).length > 0) {
      item.events.add(
        PostmanHelper.createEvent(
          "prerequest",
          PostmanHelper.createScript(
            Object.entries(step.variables)
              .map(
                ([key, value]) =>
                  `pm.variables.set("${key}", "${env.resolveObjectValues(value.value)}");`
              )
              .join("\n")
          )
        )
      );
    }

    const getOverwriteVariables = () => {
      if (step.outputVariables !== undefined && Object.keys(step.outputVariables).length > 0) {
        const ret = new Map<string, string>();
        for (const k of Object.keys(step.outputVariables)) {
          ret.set(k, step.outputVariables[k].fromResponse);
        }
        return ret;
      }
      return undefined;
    };
    for (const outputName of Object.keys(step.outputVariables ?? {})) {
      env.output(outputName, {
        type: "string",
        value: `{{${outputName}}}`,
      });
    }
    const scriptTypes: PostmanHelper.TestScriptType[] = this.opts.verbose
      ? ["DetailResponseLog", "StatusCodeAssertion"]
      : ["StatusCodeAssertion"];

    if (step.responseAssertion) {
      step.responseAssertion = env.resolveObjectValues(step.responseAssertion);
      scriptTypes.push("ResponseDataAssertion");
    }
    this.addTestScript(
      item,
      scriptTypes,
      getOverwriteVariables(),
      undefined,
      step.responseAssertion
    );

    if (step.operation["x-ms-long-running-operation"]) {
      item.description = JSON.stringify({
        type: "LRO",
        poller_item_name: `${item.name}_poller`,
        operationId: step.operation.operationId || "",
        exampleName: step.exampleFile!,
        itemName: item.name,
        step: item.name,
      });
      this.addAsLongRunningOperationItem(itemGroup, item, false, step.responseAssertion);
    } else {
      item.description = JSON.stringify({
        type: "simple",
        operationId: step.operation.operationId || "",
        exampleName: step.exampleFile!,
        itemName: item.name,
        step: item.name,
      });
    }
    // generate get
    if (step.operation._method === "put" || step.operation._method === "delete") {
      itemGroup.items.add(
        this.generatedGetOperationItem(
          item.name,
          item.request.url,
          item.name,
          step.operation._method
        )
      );
    }
  }

  private addAsLongRunningOperationItem(
    itemGroup: ItemGroup<Item>,
    item: Item,
    checkStatus: boolean = false,
    responseAssertion?: StepResponseAssertion
  ) {
    if (this.opts.skipLroPoll) return;

    const longRunningEvent = PostmanHelper.createEvent(
      "test",
      PostmanHelper.createScript(
        `
const pollingUrl = pm.response.headers.get("Location") || pm.response.headers.get("Azure-AsyncOperation");
if (pollingUrl) {
    pm.collectionVariables.set("x_polling_url", ${
      this.opts.testProxy
        ? `pollingUrl.replace("${this.opts.armEndpoint}","${this.opts.testProxy}")`
        : "pollingUrl"
    });
}`
      )
    );
    item.events.add(longRunningEvent);
    itemGroup.items.add(item);
    for (const it of this.longRunningOperationItem(item, checkStatus, responseAssertion)) {
      itemGroup.items.add(it);
    }
  }

  private addTestScript(
    item: Item,
    types: PostmanHelper.TestScriptType[] = ["StatusCodeAssertion"],
    overwriteVariables?: Map<string, string>,
    armTemplate?: ArmTemplate,
    responseAssertion?: StepResponseAssertion
  ) {
    if (this.opts.verbose) {
      types.push("DetailResponseLog");
    }
    if (overwriteVariables !== undefined) {
      types.push("OverwriteVariables");
    }
    // For post request do not output response log.
    if (item.request.method === "POST") {
      types = types.filter((it) => it !== "DetailResponseLog");
    }
    if (types.length > 0) {
      const testEvent = PostmanHelper.createEvent(
        "test",
        // generate assertion from example
        PostmanHelper.generateScript({
          name: "response status code assertion.",
          types: types,
          variables: overwriteVariables,
          armTemplate,
          responseAssertion,
        })
      );
      item.events.add(testEvent);
    }
  }

  public async sendArmTemplateDeployment(
    armTemplate: ArmTemplate,
    _armDeployment: ArmDeployment,
    step: StepArmTemplate,
    env: VariableEnv
  ): Promise<void> {
    if (this.opts.skipArmCall) return;

    const item = this.addNewItem(
      step.isPrepareStep ? "Prepare" : step.isCleanUpStep ? "CleanUp" : "Scenario",
      {
        name: step.step,
      }
    );

    const itemGroup = step.isPrepareStep
      ? this.prepareStepsFolder
      : step.isCleanUpStep
      ? this.cleanUpStepsFolder
      : this.scenarioFolder;

    item.request = new Request({
      name: step.step,
      method: "PUT",
      url: "",
      body: { mode: "raw" } as RequestBodyDefinition,
    });
    item.request.url = new Url({
      host: this.opts.testProxy ?? this.opts.armEndpoint,
      path: `/subscriptions/:subscriptionId/resourcegroups/:resourceGroupName/providers/Microsoft.Resources/deployments/:deploymentName`,
      variable: [
        { key: "subscriptionId", value: `{{subscriptionId}}` },
        { key: "resourceGroupName", value: `{{resourceGroupName}}` },
        { key: "deploymentName", value: `${step.step}` },
      ],
      query: [{ key: "api-version", value: ARM_API_VERSION }],
    });
    const body = {
      properties: {
        mode: "Incremental",
        template: convertPostmanFormat(env.resolveObjectValues(armTemplate)),
      },
    };
    for (const outputName of Object.keys(step.armTemplatePayload.outputs || {})) {
      env.output(outputName, {
        type: "string",
        value: `{{${outputName}}}`,
      });
    }
    item.request.body = new RequestBody({
      mode: "raw",
      raw: JSON.stringify(body, null, 2),
    });
    item.request.addHeader({ key: "Content-Type", value: "application/json" });
    const scriptTypes: PostmanHelper.TestScriptType[] = this.opts.verbose
      ? ["StatusCodeAssertion", "DetailResponseLog"]
      : ["StatusCodeAssertion"];
    item.events.add(
      PostmanHelper.createEvent(
        "test",
        PostmanHelper.generateScript({
          name: "response status code assertion.",
          types: scriptTypes,
          variables: undefined,
        })
      )
    );

    this.addAsLongRunningOperationItem(itemGroup, item, true);
    const generatedGetScriptTypes: PostmanHelper.TestScriptType[] = this.opts.verbose
      ? ["DetailResponseLog", "ExtractARMTemplateOutput"]
      : ["ExtractARMTemplateOutput"];
    const generatedGetOperationItem = this.generatedGetOperationItem(
      item.name,
      item.request.url,
      step.step,
      "put",
      generatedGetScriptTypes,
      armTemplate
    );
    itemGroup.items.add(generatedGetOperationItem);
  }

  private generatedGetOperationItem(
    name: string,
    url: Url,
    step: string,
    prevMethod: string = "put",
    scriptTypes: PostmanHelper.TestScriptType[] = [],
    armTemplate?: ArmTemplate
  ): Item {
    const item = this.addNewItem("Blank", {
      name: `${generatedPostmanItem(generatedGet(name))}`,
      request: {
        method: "GET",
        url: "",
      },
    });
    item.request.url = url;
    item.description = JSON.stringify({
      type: "generated-get",
      lro_item_name: name,
      step: step,
    });
    item.request.addHeader({ key: "Content-Type", value: "application/json" });
    if (prevMethod !== "delete") {
      scriptTypes.push("StatusCodeAssertion");
    }
    this.addTestScript(item, scriptTypes, undefined, armTemplate);
    return item;
  }

  public longRunningOperationItem(
    initialItem: Item,
    checkStatus: boolean = false,
    responseAssertion?: StepResponseAssertion
  ): Item[] {
    const ret: Item[] = [];

    const pollerItem = this.addNewItem("Blank", {
      name: generatedPostmanItem(initialItem.name + "_poller"),
      request: {
        url: `{{x_polling_url}}`,
        method: "GET",
      },
    });
    pollerItem.description = JSON.stringify({ type: "poller", lro_item_name: initialItem.name });

    const delay = this.mockDelayItem(pollerItem.name, initialItem.name);

    const event = PostmanHelper.createEvent(
      "test",
      PostmanHelper.createScript(
        `
try {
    if (pm.response.code === 202) {
        postman.setNextRequest('${delay.name}');
    } else if (pm.response.code === 204) {
        postman.setNextRequest($(nextRequest));
    } else {
        const terminalStatus = ["Succeeded", "Failed", "Canceled"];
        if (pm.response.json().status !== undefined && terminalStatus.indexOf(pm.response.json().status) === -1) {
            postman.setNextRequest('${delay.name}')
        } else {
            postman.setNextRequest($(nextRequest))
        }
    }
} catch(err) {
    postman.setNextRequest($(nextRequest))
}`
      )
    );
    pollerItem.events.add(event);

    if (checkStatus) {
      const checkStatusEvent = PostmanHelper.createEvent(
        "test",
        PostmanHelper.generateScript({
          name: "armTemplate deployment status check",
          types: ["StatusCodeAssertion", "ARMDeploymentStatusAssertion"],
        })
      );
      pollerItem.events.add(checkStatusEvent);
    }

    if (responseAssertion) {
      const responseAssertionEvent = PostmanHelper.createEvent(
        "test",
        PostmanHelper.generateScript({
          name: "LRO response assertion",
          types: ["ResponseDataAssertion"],
          responseAssertion: responseAssertion,
        })
      );
      pollerItem.events.add(responseAssertionEvent);
    }

    ret.push(pollerItem);
    ret.push(delay);
    return ret;
  }

  public mockDelayItem(nextRequestName: string, LROItemName: string): Item {
    const ret = this.addNewItem(
      "Blank",
      {
        name: `${nextRequestName}_mock_delay`,
        request: {
          url: "https://postman-echo.com/delay/{{x_retry_after}}",
          method: "GET",
        },
      },
      false
    );
    ret.description = JSON.stringify({ type: "mock", lro_item_name: LROItemName });

    const event = PostmanHelper.createEvent(
      "prerequest",
      PostmanHelper.createScript(`postman.setNextRequest('${nextRequestName}')`)
    );
    ret.events.add(event);
    return ret;
  }
}

const convertPostmanFormat = <T>(obj: T): T => {
  if (typeof obj === "string") {
    return covertToPostmanVariable(obj) as unknown as T;
  }
  if (typeof obj !== "object") {
    return obj;
  }
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return (obj as any[]).map((v) => convertPostmanFormat(v)) as unknown as T;
  }

  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[key] = convertPostmanFormat((obj as any)[key]);
  }
  return result;
};

const covertToPostmanVariable = (value: string, isPath: boolean = false): string => {
  return value.replace(/\$\(([a-z0-9_$]+)\)/gi, (_, p1) => (isPath ? `:${p1}` : `{{${p1}}}`));
};
