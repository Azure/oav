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
import { xmsSkipUrlEncoding } from "../util/constants";
import { JsonLoader } from "../swagger/jsonLoader";
import {
  ApiScenarioClientRequest,
  ApiScenarioRunnerClient,
  ArmDeployment,
  Scope,
} from "./apiScenarioRunner";
import {
  AADTokenAuthentication,
  ArmTemplate,
  Authentication,
  DelayItemMetadata,
  FinalGetItemMetadata,
  LroItemMetadata,
  PollerItemMetadata,
  Scenario,
  ScenarioDefinition,
  SimpleItemMetadata,
  StepArmTemplate,
  StepResponseAssertion,
  StepRestCall,
} from "./apiScenarioTypes";
import { DEFAULT_ARM_API_VERSION } from "./constants";
import * as PostmanHelper from "./postmanHelper";
import { VariableEnv } from "./variableEnv";

export interface PostmanCollectionRunnerClientOption {
  collectionName?: string;
  runId: string;
  testProxy?: string;
  verbose?: boolean;
  skipAuth?: boolean;
  skipArmCall?: boolean;
  skipLroPoll?: boolean;
  jsonLoader: JsonLoader;
}

interface PostmanAuthOption {
  type: Authentication["type"];
  tokenName: string;
  scriptLocation: "Collection" | "Folder" | "Request";
}

export class PostmanCollectionRunnerClient implements ApiScenarioRunnerClient {
  private opts: PostmanCollectionRunnerClientOption;
  private collection: Collection;
  private prepareStepsFolder: ItemGroup<Item>;
  private cleanUpStepsFolder: ItemGroup<Item>;
  private scenarioFolder: ItemGroup<Item>;
  private runtimeEnv: VariableScope;
  private authOptionMap = new Map<string, PostmanAuthOption>();

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(opts: PostmanCollectionRunnerClientOption) {
    this.opts = opts;
  }

  private checkAuthOption(
    auth: Authentication,
    location: PostmanAuthOption["scriptLocation"]
  ): PostmanAuthOption | undefined {
    if (auth.type === "AADToken" && auth.scope) {
      if (!this.authOptionMap.has(auth.scope)) {
        this.authOptionMap.set(auth.scope, {
          type: auth.type,
          tokenName: `x_bearer_token_${this.authOptionMap.size}`,
          scriptLocation: location,
        });
      }
      return this.authOptionMap.get(auth.scope);
    } else if (auth.type === "AzureKey") {
      // TODO
    } else if (auth.type === "None") {
      // TODO
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

    const preScripts: string[] = [];

    scenarioDef.authentication = scope.env.resolveObjectValues(scenarioDef.authentication);
    const authOption = this.checkAuthOption(scenarioDef.authentication, "Collection");

    if (authOption) {
      this.collection.auth = new RequestAuth({
        type: "bearer",
        bearer: [
          {
            key: "token",
            value: `{{${authOption.tokenName}}}`,
            type: "string",
          },
        ],
      });
      preScripts.push(
        PostmanHelper.generateAuthScript(
          (scenarioDef.authentication as AADTokenAuthentication).scope!,
          authOption.tokenName
        )
      );
    }

    if (preScripts.length > 0) {
      PostmanHelper.addEvent(this.collection.events, "prerequest", preScripts);
    }

    scope.env.resolve();

    this.runtimeEnv = new VariableScope({});
    this.runtimeEnv.set("tenantId", scope.env.get("tenantId")?.value, "string");
    this.runtimeEnv.set("client_id", scope.env.get("client_id")?.value, "string");
    this.runtimeEnv.set("client_secret", scope.env.get("client_secret")?.value, "string");
    this.runtimeEnv.set("armEndpoint", scope.env.get("armEndpoint")?.value, "string");
    this.runtimeEnv.set("subscriptionId", scope.env.get("subscriptionId")?.value, "string");
    this.runtimeEnv.set("resourceGroupName", scope.env.get("resourceGroupName")?.value, "string");
    this.runtimeEnv.set("location", scope.env.get("location")?.value, "string");

    for (const [name, variable] of scope.env.getVariables()) {
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

  public async prepareScenario(scenario: Scenario, env: VariableEnv): Promise<void> {
    this.scenarioFolder = PostmanHelper.addItemGroup(this.collection, {
      name: scenario.scenario,
      description: scenario.description,
    });

    const preScripts: string[] = [];

    scenario.authentication = env.resolveObjectValues(scenario.authentication);
    const authOption = this.checkAuthOption(scenario.authentication, "Folder");

    if (authOption && authOption.scriptLocation === "Folder") {
      this.scenarioFolder.auth = new RequestAuth({
        type: "bearer",
        bearer: [
          {
            key: "token",
            value: `{{${authOption.tokenName}}}`,
            type: "string",
          },
        ],
      });
      preScripts.push(
        PostmanHelper.generateAuthScript(
          (scenario.authentication as AADTokenAuthentication).scope!,
          authOption.tokenName
        )
      );
    }

    env.resolve();

    if (Object.keys(scenario.variables).length > 0) {
      Object.entries(scenario.variables).forEach(([key, value]) => {
        if (value.value) {
          preScripts.push(
            `pm.variables.set("${key}", ${JSON.stringify(env.resolveObjectValues(value.value))});`
          );
        }
      });
    }

    if (preScripts.length > 0) {
      PostmanHelper.addEvent(this.scenarioFolder.events, "prerequest", preScripts);
    }

    // TODO output variables
  }

  public outputCollection(): [Collection, VariableScope] {
    if (this.opts.testProxy) {
      this.stopTestProxyRecording();
    }

    return [this.collection, this.runtimeEnv];
  }

  private startTestProxyRecording() {
    const { item } = this.addNewItem("Prepare", {
      name: "startTestProxyRecording",
      request: {
        url: `${this.opts.testProxy}/record/start`,
        method: "POST",
        body: {
          mode: "raw",
          raw: `{"x-recording-file": "./recordings/${this.opts.collectionName}_${this.opts.runId}.json"}`,
        },
      },
    });
    PostmanHelper.addEvent(
      item.events,
      "test",
      `
pm.test("Started TestProxy recording", function() {
    pm.response.to.be.success;
    pm.response.to.have.header("x-recording-id");
    pm.variables.set("x_recording_id", pm.response.headers.get("x-recording-id"));
});`
    );
  }

  private stopTestProxyRecording() {
    const { item } = this.addNewItem("CleanUp", {
      name: "stopTestProxyRecording",
      request: {
        url: `${this.opts.testProxy}/record/stop`,
        method: "POST",
      },
    });
    item.request.addHeader({
      key: "x-recording-id",
      value: "{{x_recording_id}}",
    });
    PostmanHelper.addEvent(
      item.events,
      "test",
      `
pm.test("Stopped TestProxy recording", function() {
    pm.response.to.be.success;
});
`
    );
  }

  private addNewItem(
    itemType: "Prepare" | "CleanUp" | "Scenario" | "Blank",
    definition?: ItemDefinition,
    baseUriForTestProxy?: string
  ): { item: Item; itemGroup?: ItemGroup<Item> } {
    const item = PostmanHelper.createItem(definition);
    let itemGroup: ItemGroup<Item> | undefined;

    if (this.opts.testProxy && baseUriForTestProxy) {
      item.request.addHeader({
        key: "x-recording-upstream-base-uri",
        value: baseUriForTestProxy,
      });
      item.request.addHeader({ key: "x-recording-id", value: "{{x_recording_id}}" });
      item.request.addHeader({ key: "x-recording-mode", value: "record" });
    }

    switch (itemType) {
      case "Prepare":
        if (this.prepareStepsFolder === undefined) {
          this.prepareStepsFolder = PostmanHelper.addItemGroup(this.collection, {
            name: PostmanHelper.PREPARE_FOLDER,
          });
        }
        itemGroup = this.prepareStepsFolder;
        break;
      case "CleanUp":
        if (this.cleanUpStepsFolder === undefined) {
          this.cleanUpStepsFolder = PostmanHelper.addItemGroup(this.collection, {
            name: PostmanHelper.CLEANUP_FOLDER,
          });
        }
        itemGroup = this.cleanUpStepsFolder;
        break;
      case "Scenario":
        if (this.scenarioFolder === undefined) {
          throw new Error("Scenario folder is not initialized");
        }
        itemGroup = this.scenarioFolder;
        break;
      case "Blank":
        break;
    }

    if (itemGroup) {
      itemGroup.items.add(item);
    }

    return {
      item,
      itemGroup,
    };
  }

  public async createResourceGroup(
    armEndpoint: string,
    subscriptionId: string,
    resourceGroupName: string,
    location: string
  ): Promise<void> {
    if (this.opts.skipArmCall) return;

    const { item } = this.addNewItem(
      "Prepare",
      {
        name: "createResourceGroup",
      },
      armEndpoint
    );

    item.request.method = "PUT";
    item.request.url = new Url({
      host: this.opts.testProxy ?? armEndpoint,
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
          value: DEFAULT_ARM_API_VERSION,
        },
      ],
    });
    item.request.body = new RequestBody({
      mode: "raw",
      raw: '{"location":"{{location}}"}',
    });

    item.request.addHeader({ key: "Content-Type", value: "application/json" });

    const postScripts = this.generatePostScripts();
    if (postScripts.length > 0) {
      PostmanHelper.addEvent(item.events, "test", postScripts);
    }

    this.runtimeEnv.set("subscriptionId", subscriptionId, "string");
    this.runtimeEnv.set("resourceGroupName", resourceGroupName, "string");
    this.runtimeEnv.set("location", location, "string");
  }

  public async deleteResourceGroup(
    armEndpoint: string,
    _subscriptionId: string,
    _resourceGroupName: string
  ): Promise<void> {
    if (this.opts.skipArmCall) return;

    const { item } = this.addNewItem(
      "CleanUp",
      {
        name: "deleteResourceGroup",
      },
      armEndpoint
    );
    item.request.method = "DELETE";
    item.request.url = new Url({
      host: this.opts.testProxy ?? armEndpoint,
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
          value: DEFAULT_ARM_API_VERSION,
        },
      ],
    });

    item.request.addHeader({ key: "Content-Type", value: "application/json" });

    const postScripts: string[] = [];

    PostmanHelper.appendScripts(postScripts, {
      name: "response code should be 2xx",
      types: ["StatusCodeAssertion"],
    });

    // Do not poll deleteResourceGroup
    // this.lroPoll(this.cleanUpStepsFolder, item, armEndpoint, postScripts);

    if (postScripts.length > 0) {
      PostmanHelper.addEvent(item.events, "test", postScripts);
    }
  }

  public async sendRestCallRequest(
    clientRequest: ApiScenarioClientRequest,
    step: StepRestCall,
    env: VariableEnv
  ): Promise<void> {
    env.resolve();

    const baseUri = convertPostmanFormat(env.tryResolveString(clientRequest.host));

    const { item, itemGroup } = this.addNewItem(
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
      },
      baseUri
    );

    // pre scripts
    const preScripts: string[] = [];

    step.authentication = env.resolveObjectValues(step.authentication);
    const authOption = this.checkAuthOption(step.authentication, "Request");

    if (authOption && authOption.scriptLocation === "Request") {
      item.request.auth = new RequestAuth({
        type: "bearer",
        bearer: [
          {
            key: "token",
            value: `{{${authOption.tokenName}}}`,
            type: "string",
          },
        ],
      });
      preScripts.push(
        PostmanHelper.generateAuthScript(
          (step.authentication as AADTokenAuthentication).scope!,
          authOption.tokenName
        )
      );
    }

    item.description = step.operationId;

    item.request.url = new Url({
      host: this.opts.testProxy ?? baseUri,
      path: covertToPostmanVariable(clientRequest.path, true),
      variable: Object.entries(clientRequest.pathParameters ?? {}).map(([key, value]) => ({
        key,
        value: convertPostmanFormat(value),
      })),
      query: Object.entries(clientRequest.query).map(([key, value]) => ({
        key,
        value: convertPostmanFormat(value)?.toString(),
      })),
    });

    if (clientRequest.body) {
      item.request.addHeader({
        key: "Content-Type",
        value:
          step.operation?.consumes?.[0] ??
          step.operation?._path?._spec?.consumes?.[0] ??
          "application/json",
      });
    }
    Object.entries(clientRequest.headers).forEach(([key, value]) => {
      item.request.addHeader({ key, value: convertPostmanFormat(value) });
    });

    step._resolvedParameters = env.resolveObjectValues(step.parameters);

    if (Object.keys(step.variables).length > 0) {
      Object.entries(step.variables).forEach(([key, value]) =>
        preScripts.push(
          `pm.variables.set("${key}", ${JSON.stringify(env.resolveObjectValues(value.value))});`
        )
      );
    }

    const replaceKey = new Set<string>();
    const jsonLoader = this.opts.jsonLoader;

    const encodeVariable = function (variable: { key?: string | null; value: string | null }) {
      let skipEncode = false;
      step.operation?.parameters?.forEach((p) => {
        p = jsonLoader.resolveRefObj(p);
        if (p.name === variable.key && p.in === "path" && p[xmsSkipUrlEncoding]) {
          skipEncode = true;
        }
      });
      if (skipEncode) {
        return;
      }
      const regex = /\{\{([A-Za-z_$][A-Za-z0-9_]*)\}\}/g;
      const replaceArray: Array<[number, number, string]> = [];
      let match,
        index = variable.value!.length;
      while ((match = regex.exec(variable.value!))) {
        replaceKey.add(match[1]);
        replaceArray.push([match.index, match.index + match[0].length, `{{${match[1]}_encoded}}`]);
        index = match.index + match[0].length;
      }
      replaceArray.push([index, variable.value!.length, ""]);
      let r,
        value = "";
      index = 0;
      while ((r = replaceArray.shift())) {
        value += encodeURIComponent(variable.value!.substring(index, r[0])) + r[2];
        index = r[1];
      }
      variable.value = value;
    };

    item.request.url.variables.each(encodeVariable);
    item.request.url.query.each(encodeVariable);

    replaceKey.forEach((key) => {
      preScripts.push(
        `pm.variables.set("${key}_encoded", encodeURIComponent(pm.variables.get("${key}")));`
      );
    });

    if (preScripts.length > 0) {
      PostmanHelper.addEvent(item.events, "prerequest", preScripts);
    }

    // post scripts
    const postScripts: string[] = [];

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
    this.generatePostScripts(
      scriptTypes,
      getOverwriteVariables(),
      undefined,
      step.responseAssertion
    ).forEach((s) => postScripts.push(s));

    if (step.operation && step.operation["x-ms-long-running-operation"]) {
      const metadata: LroItemMetadata = {
        type: "LRO",
        poller_item_name: `_${item.name}_poller`,
        operationId: step.operation.operationId || "",
        exampleName: step.exampleFile!,
        itemName: item.name,
        step: item.name,
      };
      item.description = JSON.stringify(metadata);
      this.lroPoll(
        itemGroup!,
        item,
        clientRequest.host,
        postScripts,
        false,
        step.responseAssertion
      );

      // generate final get
      if (step.operation?._method !== "post") {
        itemGroup!.items.add(
          this.generateFinalGetItem(
            item.name,
            baseUri,
            item.request.url,
            item.name,
            step.operation._method
          )
        );
      }
    } else {
      const metadata: SimpleItemMetadata = {
        type: "simple",
        operationId: step.operation?.operationId || "",
        exampleName: step.exampleFile!,
        itemName: item.name,
        step: item.name,
      };
      item.description = JSON.stringify(metadata);
    }

    if (postScripts.length > 0) {
      PostmanHelper.addEvent(item.events, "test", postScripts);
    }
  }

  private lroPoll(
    itemGroup: ItemGroup<Item>,
    item: Item,
    baseUri: string,
    postScripts: string[],
    checkStatus: boolean = false,
    responseAssertion?: StepResponseAssertion
  ) {
    if (this.opts.skipLroPoll) return;

    postScripts.push(
      `
const pollingUrl = pm.response.headers.get("Location") || pm.response.headers.get("Azure-AsyncOperation");
if (pollingUrl) {
    pm.variables.set("x_polling_url", ${
      this.opts.testProxy
        ? `pollingUrl.replace("${baseUri}","${this.opts.testProxy}")`
        : "pollingUrl"
    });
    pm.variables.set("x_retry_after", "3");
}`
    );

    const { item: delayItem } = this.addNewItem("Blank", {
      name: `_${item.name}_delay`,
      request: {
        url: "https://postman-echo.com/delay/{{x_retry_after}}",
        method: "GET",
      },
    });
    const delayItemMetadata: DelayItemMetadata = {
      type: "delay",
      lro_item_name: item.name,
    };
    delayItem.description = JSON.stringify(delayItemMetadata);

    itemGroup.items.add(delayItem);

    const { item: pollerItem } = this.addNewItem(
      "Blank",
      {
        name: `_${item.name}_poller`,
        request: {
          url: `{{x_polling_url}}`,
          method: "GET",
        },
      },
      baseUri
    );
    const pollerItemMetadata: PollerItemMetadata = {
      type: "poller",
      lro_item_name: item.name,
    };

    pollerItem.description = JSON.stringify(pollerItemMetadata);

    const pollerPostScripts: string[] = [];
    pollerPostScripts.push(
      `
try {
    if (pm.response.code === 202) {
        postman.setNextRequest("${delayItem.name}");
        if (pm.response.headers.has("Retry-After")) {
            pm.variables.set("x_retry_after", pm.response.headers.get("Retry-After"));
        }
    } else if (pm.response.size().body > 0) {
        const terminalStatus = ["Succeeded", "Failed", "Canceled"];
        const json = pm.response.json();
        if (json.status !== undefined && terminalStatus.indexOf(json.status) === -1) {
            postman.setNextRequest("${delayItem.name}")
            if (pm.response.headers.has("Retry-After")) {
                pm.variables.set("x_retry_after", pm.response.headers.get("Retry-After"));
            }
        }
    }
} catch (err) {
  console.error(err);
}
`
    );

    if (checkStatus) {
      PostmanHelper.appendScripts(pollerPostScripts, {
        name: "armTemplate deployment status check",
        types: ["StatusCodeAssertion", "ARMDeploymentStatusAssertion"],
      });
    }

    if (responseAssertion) {
      PostmanHelper.appendScripts(pollerPostScripts, {
        name: "LRO response assertion",
        types: ["ResponseDataAssertion"],
        responseAssertion: responseAssertion,
      });
    }

    if (postScripts.length > 0) {
      PostmanHelper.addEvent(pollerItem.events, "test", pollerPostScripts);
    }

    itemGroup.items.add(pollerItem);
  }

  private generatePostScripts(
    types: PostmanHelper.TestScriptType[] = ["StatusCodeAssertion"],
    overwriteVariables?: Map<string, string>,
    armTemplate?: ArmTemplate,
    responseAssertion?: StepResponseAssertion
  ): string[] {
    const scripts: string[] = [];
    if (this.opts.verbose) {
      types.push("DetailResponseLog");
    }
    if (overwriteVariables !== undefined) {
      types.push("OverwriteVariables");
    }
    // TODO For post request do not output response log.
    // if (item.request.method === "POST") {
    //   types = types.filter((it) => it !== "DetailResponseLog");
    // }
    if (types.length > 0) {
      // generate assertion from example
      PostmanHelper.appendScripts(scripts, {
        name: "response status code assertion.",
        types: types,
        variables: overwriteVariables,
        armTemplate,
        responseAssertion,
      });
    }
    return scripts;
  }

  public async sendArmTemplateDeployment(
    armEndpoint: string,
    armTemplate: ArmTemplate,
    _armDeployment: ArmDeployment,
    step: StepArmTemplate,
    env: VariableEnv
  ): Promise<void> {
    if (this.opts.skipArmCall) return;

    const { item, itemGroup } = this.addNewItem(
      step.isPrepareStep ? "Prepare" : step.isCleanUpStep ? "CleanUp" : "Scenario",
      {
        name: step.step,
      },
      armEndpoint
    );

    item.request = new Request({
      name: step.step,
      method: "PUT",
      url: "",
      body: { mode: "raw" } as RequestBodyDefinition,
    });
    item.request.url = new Url({
      host: this.opts.testProxy ?? armEndpoint,
      path: `/subscriptions/:subscriptionId/resourcegroups/:resourceGroupName/providers/Microsoft.Resources/deployments/:deploymentName`,
      variable: [
        { key: "subscriptionId", value: `{{subscriptionId}}` },
        { key: "resourceGroupName", value: `{{resourceGroupName}}` },
        { key: "deploymentName", value: `${step.step}` },
      ],
      query: [{ key: "api-version", value: DEFAULT_ARM_API_VERSION }],
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

    const postScripts: string[] = [];
    PostmanHelper.appendScripts(postScripts, {
      name: "response status code assertion.",
      types: scriptTypes,
      variables: undefined,
    });

    this.lroPoll(itemGroup!, item, armEndpoint, postScripts, true);

    if (postScripts.length > 0) {
      PostmanHelper.addEvent(item.events, "test", postScripts);
    }

    const generatedGetScriptTypes: PostmanHelper.TestScriptType[] = this.opts.verbose
      ? ["DetailResponseLog", "ExtractARMTemplateOutput"]
      : ["ExtractARMTemplateOutput"];
    const generatedGetOperationItem = this.generateFinalGetItem(
      item.name,
      armEndpoint,
      item.request.url,
      step.step,
      "put",
      generatedGetScriptTypes,
      armTemplate
    );
    itemGroup!.items.add(generatedGetOperationItem);
  }

  private generateFinalGetItem(
    name: string,
    baseUri: string,
    url: Url,
    step: string,
    prevMethod: string = "put",
    scriptTypes: PostmanHelper.TestScriptType[] = [],
    armTemplate?: ArmTemplate
  ): Item {
    const { item } = this.addNewItem(
      "Blank",
      {
        name: `_${name}_final_get`,
        request: {
          method: "GET",
          url: "",
        },
      },
      baseUri
    );
    item.request.url = url;
    const metadata: FinalGetItemMetadata = {
      type: "finalGet",
      lro_item_name: name,
      step,
    };
    item.description = JSON.stringify(metadata);
    item.request.addHeader({ key: "Content-Type", value: "application/json" });
    if (prevMethod !== "delete") {
      scriptTypes.push("StatusCodeAssertion");
    }
    const postScripts = this.generatePostScripts(scriptTypes, undefined, armTemplate);
    if (postScripts.length > 0) {
      PostmanHelper.addEvent(item.events, "test", postScripts);
    }
    return item;
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
    const newKey = covertToPostmanVariable(key);
    result[newKey] = convertPostmanFormat((obj as any)[key]);
  }
  return result;
};

const covertToPostmanVariable = (value: string, isPath: boolean = false): string => {
  return value.replace(/\$\(([a-z0-9-_$]+)\)/gi, (_, p1) => (isPath ? `:${p1}` : `{{${p1}}}`));
};
