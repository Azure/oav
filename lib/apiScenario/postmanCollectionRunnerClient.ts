import {
  Collection,
  Item,
  ItemDefinition,
  Request,
  RequestAuth,
  RequestBody,
  RequestBodyDefinition,
  Url,
  Variable,
  VariableScope,
} from "postman-collection";
import { setDefaultOpts } from "../swagger/loader";
import {
  ApiScenarioClientRequest,
  ApiScenarioRunnerClient,
  ArmDeployment,
} from "./apiScenarioRunner";
import {
  ArmTemplate,
  Scenario,
  StepArmTemplate,
  StepResponseAssertion,
  StepRestCall,
} from "./apiScenarioTypes";
import { generatedGet, generatedPostmanItem } from "./defaultNaming";
import { typeToDescription } from "./postmanItemTypes";
import * as PostmanHelper from "./postmanHelper";
import { VariableEnv } from "./variableEnv";

export interface PostmanCollectionRunnerClientOption {
  apiScenarioFileName: string;
  apiScenarioFilePath?: string;
  apiScenarioName?: string;
  runId: string;
  swaggerFilePaths?: string[];
  baseUrl: string;
  testProxy?: string;
  verbose?: boolean;
}

const ARM_ENDPOINT = "https://management.azure.com";
const ARM_API_VERSION = "2020-06-01";

export class PostmanCollectionRunnerClient implements ApiScenarioRunnerClient {
  private opts: PostmanCollectionRunnerClientOption;
  private collection: Collection;
  private runtimeEnv: VariableScope;

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(opts: PostmanCollectionRunnerClientOption) {
    this.opts = opts;
    setDefaultOpts(this.opts, {
      baseUrl: ARM_ENDPOINT,
    } as PostmanCollectionRunnerClientOption);
  }

  public async prepareScenario(scenario: Scenario, env: VariableEnv): Promise<void> {
    this.opts.apiScenarioName = scenario.scenario;
    this.opts.apiScenarioFileName = scenario._scenarioDef._filePath;

    this.collection = new Collection({
      info: {
        id: this.opts.runId,
        name: this.opts.apiScenarioName,
      },
    });
    this.collection.describe(
      JSON.stringify({
        apiScenarioFilePath: this.opts.apiScenarioFilePath,
        apiScenarioName: this.opts.apiScenarioName,
        swaggerFilePaths: this.opts.swaggerFilePaths,
      })
    );
    this.collection.auth = new RequestAuth({
      type: "bearer",
      bearer: [
        {
          key: "token",
          value: "{{x_bearer_token}}",
          type: "string",
        },
      ],
    });
    this.collection.events.add(
      PostmanHelper.createEvent("prerequest", PostmanHelper.generateAuthScript(this.opts.baseUrl))
    );

    env.resolve();

    this.runtimeEnv = new VariableScope({});
    this.runtimeEnv.set("tenantId", env.get("tenantId")?.value, "string");
    this.runtimeEnv.set("client_id", env.get("client_id")?.value, "string");
    this.runtimeEnv.set("client_secret", env.get("client_secret")?.value, "string");
    this.runtimeEnv.set("subscriptionId", env.get("subscriptionId")?.value, "string");
    this.runtimeEnv.set("resourceGroupName", env.get("resourceGroupName")?.value, "string");
    this.runtimeEnv.set("location", env.get("location")?.value, "string");

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
        this.collection.variables.add(new Variable(variable));
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
    const item = this.newItem(
      {
        name: "startTestProxyRecording",
        request: {
          url: `${this.opts.testProxy}/record/start`,
          method: "POST",
          body: {
            mode: "raw",
            raw: `{"x-recording-file": "./recordings/${this.opts.apiScenarioName}_${this.opts.runId}.json"}`,
          },
        },
      },
      false
    );
    item.events.add(
      PostmanHelper.createEvent(
        "test",
        PostmanHelper.createScript(`pm.test("Started TestProxy recording", function(){
    pm.response.to.be.success;
    pm.response.to.have.header('x-recording-id');
    pm.collectionVariables.set('x_recording_id', pm.response.headers.get('x-recording-id'));
});
`)
      )
    );
    this.collection.items.add(item);
  }

  private stopTestProxyRecording() {
    const item = this.newItem(
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
          `pm.test("Stopped TestProxy recording", function(){
    pm.response.to.be.success;
});
`
        )
      )
    );
    this.collection.items.add(item);
  }

  private newItem(definition?: ItemDefinition, checkTestProxy: boolean = true): Item {
    const item = PostmanHelper.createItem(definition);
    if (checkTestProxy && this.opts.testProxy) {
      item.request.addHeader({ key: "x-recording-upstream-base-uri", value: this.opts.baseUrl });
      item.request.addHeader({ key: "x-recording-id", value: "{{x_recording_id}}" });
      item.request.addHeader({ key: "x-recording-mode", value: "record" });
    }
    return item;
  }

  public async createResourceGroup(
    subscriptionId: string,
    resourceGroupName: string,
    location: string
  ): Promise<void> {
    const item = this.newItem({
      name: "createResourceGroup",
    });

    item.request.method = "PUT";
    item.request.url = new Url({
      host: this.opts.testProxy ?? this.opts.baseUrl,
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

    item.description = typeToDescription({ type: "prepare" });

    item.request.addHeader({ key: "Content-Type", value: "application/json" });

    this.addTestScript(item);

    this.runtimeEnv.set("subscriptionId", subscriptionId, "string");
    this.runtimeEnv.set("resourceGroupName", resourceGroupName, "string");
    this.runtimeEnv.set("location", location, "string");

    this.collection.items.add(item);
  }

  public async deleteResourceGroup(
    _subscriptionId: string,
    _resourceGroupName: string
  ): Promise<void> {
    const item = this.newItem({
      name: "deleteResourceGroup",
    });
    item.request.method = "DELETE";
    item.request.url = new Url({
      host: this.opts.testProxy ?? this.opts.baseUrl,
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

    this.addAsLongRunningOperationItem(item);
  }

  public async sendRestCallRequest(
    clientRequest: ApiScenarioClientRequest,
    step: StepRestCall,
    env: VariableEnv
  ): Promise<void> {
    const item = this.newItem({
      name: step.step,
      request: {
        method: clientRequest.method,
        url: clientRequest.path,
        body: clientRequest.body
          ? { mode: "raw", raw: JSON.stringify(convertPostmanFormat(clientRequest.body), null, 2) }
          : undefined,
      },
    });

    item.description = step.operation.operationId;

    item.request.url = new Url({
      host: this.opts.testProxy ?? this.opts.baseUrl,
      path: covertToPostmanVariable(clientRequest.path, true),
      variable: Object.entries(clientRequest.pathVariables ?? {}).map(([key, value]) => ({
        key,
        value: convertPostmanFormat(value),
      })),
      query: Object.entries(clientRequest.query).map(([key, value]) => ({
        key,
        value: covertToPostmanVariable(value),
      })),
    });

    item.request.addHeader({ key: "Content-Type", value: "application/json" });
    Object.entries(clientRequest.headers).forEach(([key, value]) => {
      item.request.addHeader({ key, value: covertToPostmanVariable(value) });
    });

    this.collection.items.add(item);

    env.resolve();

    if (Object.keys(step.variables).length > 0) {
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
      item.description = typeToDescription({
        type: "LRO",
        poller_item_name: `${item.name}_poller`,
        operationId: step.operation.operationId || "",
        exampleName: step.exampleFile!,
        itemName: item.name,
        step: item.name,
      });
      this.addAsLongRunningOperationItem(item);
    } else {
      item.description = typeToDescription({
        type: "simple",
        operationId: step.operation.operationId || "",
        exampleName: step.exampleFile!,
        itemName: item.name,
        step: item.name,
      });
      this.collection.items.add(item);
    }
    // generate get
    if (step.operation._method === "put" || step.operation._method === "delete") {
      this.collection.items.add(
        this.generatedGetOperationItem(
          item.name,
          item.request.url,
          item.name,
          step.operation._method
        )
      );
    }
  }

  private addAsLongRunningOperationItem(item: Item, checkStatus: boolean = false) {
    const longRunningEvent = PostmanHelper.createEvent(
      "test",
      PostmanHelper.createScript(
        `const pollingUrl = pm.response.headers.get('Location') || pm.response.headers.get('Azure-AsyncOperation');
        if (pollingUrl) {
          pm.collectionVariables.set("x_polling_url", ${
            this.opts.testProxy
              ? `pollingUrl.replace("${this.opts.baseUrl}","${this.opts.testProxy}")`
              : "pollingUrl"
          });
        }
        `
      )
    );
    item.events.add(longRunningEvent);
    this.collection.items.add(item);
    for (const it of this.longRunningOperationItem(item, checkStatus)) {
      this.collection.items.append(it);
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

  public async sendArmTemplateDeployment(
    armTemplate: ArmTemplate,
    _armDeployment: ArmDeployment,
    step: StepArmTemplate,
    env: VariableEnv
  ): Promise<void> {
    const item = this.newItem({
      name: step.step,
    });

    item.request = new Request({
      name: step.step,
      method: "PUT",
      url: "",
      body: { mode: "raw" } as RequestBodyDefinition,
    });
    item.request.url = new Url({
      host: this.opts.testProxy ?? this.opts.baseUrl,
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
        mode: "Complete",
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
    this.collection.items.add(item);
    this.addAsLongRunningOperationItem(item, true);
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
    this.collection.items.add(generatedGetOperationItem);
  }

  private generatedGetOperationItem(
    name: string,
    url: Url,
    step: string,
    prevMethod: string = "put",
    scriptTypes: PostmanHelper.TestScriptType[] = [],
    armTemplate?: ArmTemplate
  ): Item {
    const item = this.newItem({
      name: `${generatedPostmanItem(generatedGet(name))}`,
      request: {
        method: "GET",
        url: "",
      },
    });
    item.request.url = url;
    item.description = typeToDescription({
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

  public longRunningOperationItem(initialItem: Item, checkStatus: boolean = false): Item[] {
    const ret: Item[] = [];

    const pollerItem = this.newItem({
      name: generatedPostmanItem(initialItem.name + "_poller"),
      request: {
        url: `{{x_polling_url}}`,
        method: "GET",
      },
    });
    pollerItem.description = typeToDescription({ type: "poller", lro_item_name: initialItem.name });

    const delay = this.mockDelayItem(pollerItem.name, initialItem.name);

    const event = PostmanHelper.createEvent(
      "test",
      PostmanHelper.createScript(`try{
  if(pm.response.code === 202){
    postman.setNextRequest('${delay.name}')
  }else if(pm.response.code === 204){
    postman.setNextRequest($(nextRequest))
  }
  else{
    const terminalStatus = ["Succeeded", "Failed", "Canceled"]
    if(pm.response.json().status !== undefined && terminalStatus.indexOf(pm.response.json().status) === -1){
      postman.setNextRequest('${delay.name}')
    }else{
      postman.setNextRequest($(nextRequest))
    }
  }
}catch(err){
  postman.setNextRequest($(nextRequest))
}`)
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

    ret.push(pollerItem);
    ret.push(delay);
    return ret;
  }

  public mockDelayItem(nextRequestName: string, LROItemName: string): Item {
    const ret = this.newItem(
      {
        name: `${nextRequestName}_mock_delay`,
        request: {
          url: "https://postman-echo.com/delay/{{x_retry_after}}",
          method: "GET",
        },
      },
      false
    );
    ret.description = typeToDescription({ type: "mock", lro_item_name: LROItemName });

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
  return value.replace(/\$\(([a-z0-9_]+)\)/gi, (_, p1) => (isPath ? `:${p1}` : `{{${p1}}}`));
};
