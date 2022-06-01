import path, { dirname } from "path";
import { inject, injectable } from "inversify";
import newman from "newman";
import {
  Collection,
  Item,
  ItemDefinition,
  Request,
  RequestAuth,
  RequestBody,
  RequestBodyDefinition,
  Url,
  VariableScope,
} from "postman-collection";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import { FileLoader } from "../swagger/fileLoader";
import { JsonLoader, JsonLoaderOption } from "../swagger/jsonLoader";
import { setDefaultOpts } from "../swagger/loader";
import { getRandomString, printWarning } from "../util/utils";
import {
  ApiScenarioClientRequest,
  ApiScenarioRunnerClient,
  ArmDeploymentTracking,
} from "./apiScenarioRunner";
import { ArmTemplate, ScenarioDefinition, StepArmTemplate, StepRestCall } from "./apiScenarioTypes";
import { BlobUploader, BlobUploaderOption } from "./blobUploader";
import { DataMasker } from "./dataMasker";
import {
  defaultCollectionFileName,
  defaultEnvFileName,
  defaultNewmanReport,
  generatedGet,
  generatedPostmanItem,
} from "./defaultNaming";
import { typeToDescription } from "./postmanItemTypes";
import { NewmanReportAnalyzer, NewmanReportAnalyzerOption } from "./postmanReportAnalyzer";
import { NewmanReport } from "./postmanReportParser";
import * as PostmanHelper from "./postmanHelper";
import { ValidationLevel } from "./reportGenerator";
import { RuntimeEnvManager } from "./runtimeEnvManager";
import { SwaggerAnalyzer } from "./swaggerAnalyzer";
import { VariableEnv } from "./variableEnv";

export interface PostmanCollectionRunnerClientOption extends BlobUploaderOption, JsonLoaderOption {
  apiScenarioFileName: string;
  enableBlobUploader: boolean;
  env: VariableEnv;
  scenarioDef?: ScenarioDefinition;
  apiScenarioFilePath?: string;
  reportOutputFolder?: string;
  markdownReportPath?: string;
  junitReportPath?: string;
  apiScenarioName: string;
  runId: string;
  jsonLoader?: JsonLoader;
  swaggerFilePaths?: string[];
  baseUrl: string;
  testProxy?: string;
  validationLevel?: ValidationLevel;
  skipCleanUp?: boolean;
  from?: string;
  to?: string;
  verbose?: boolean;
}

export const generateRunId = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear().toString();
  const MM = pad(today.getMonth() + 1, 2);
  const dd = pad(today.getDate(), 2);
  const hh = pad(today.getHours(), 2);
  const mm = pad(today.getMinutes(), 2);
  const id = getRandomString();
  return yyyy + MM + dd + hh + mm + "-" + id;
};

function pad(number: number, length: number) {
  let str = "" + number;
  while (str.length < length) {
    str = "0" + str;
  }
  return str;
}

const ARM_ENDPOINT = "https://management.azure.com";
const ARM_API_VERSION = "2020-06-01";

@injectable()
export class PostmanCollectionRunnerClient implements ApiScenarioRunnerClient {
  public collection: Collection;
  public collectionEnv: VariableScope;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: PostmanCollectionRunnerClientOption,
    private blobUploader: BlobUploader,
    private dataMasker: DataMasker,
    private swaggerAnalyzer: SwaggerAnalyzer,
    private fileLoader: FileLoader
  ) {
    setDefaultOpts(this.opts, {
      apiScenarioFileName: "",
      apiScenarioFilePath: "",
      env: new VariableEnv(),
      reportOutputFolder: path.resolve(process.cwd(), "newman"),
      enableBlobUploader: false,
      runId: generateRunId(),
      apiScenarioName: "",
      blobConnectionString: process.env.blobConnectionString || "",
      baseUrl: ARM_ENDPOINT,
    });
    this.collection = new Collection({
      info: {
        id: this.opts.runId,
        name: this.opts.apiScenarioFileName,
      },
      variable: [
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
          key: "enable_auth",
          value: "true",
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
          key: "bearer_token",
          type: "secret",
        },
        {
          key: "bearer_token_expires_on",
        },
        {
          key: "x_polling_url",
        },
        {
          key: "x_retry_after",
          value: "10",
        },
      ],
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
          value: "{{bearer_token}}",
          type: "string",
        },
      ],
    });
    this.collection.events.add(
      PostmanHelper.createEvent("prerequest", PostmanHelper.generateAuthScript(this.opts.baseUrl))
    );

    this.collectionEnv = new VariableScope({});
    this.collectionEnv.set("tenantId", this.opts.env.get("tenantId")?.value, "string");
    this.collectionEnv.set("client_id", this.opts.env.get("client_id")?.value, "string");
    this.collectionEnv.set("client_secret", this.opts.env.get("client_secret")?.value, "string");
    this.collectionEnv.set("subscriptionId", this.opts.env.get("subscriptionId")?.value, "string");
    this.collectionEnv.set("location", this.opts.env.get("location")?.value, "string");
  }

  public async startTestProxyRecording(): Promise<void> {
    if (!this.opts.testProxy) {
      return;
    }
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

  public async stopTestProxyRecording(): Promise<void> {
    if (!this.opts.testProxy) {
      return;
    }
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

    this.collectionEnv.set("subscriptionId", subscriptionId, "string");
    this.collectionEnv.set("resourceGroupName", resourceGroupName, "string");
    this.collectionEnv.set("location", location, "string");

    this.collection.items.add(item);
  }

  public async deleteResourceGroup(
    _subscriptionId: string,
    _resourceGroupName: string
  ): Promise<void> {
    if (this.opts.from || this.opts.to) {
      return;
    }
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
    this.addTestScript(item, scriptTypes, getOverwriteVariables());

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
    armTemplate?: ArmTemplate
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
      })
    );
    item.events.add(testEvent);
  }

  public async sendArmTemplateDeployment(
    armTemplate: ArmTemplate,
    _armDeployment: ArmDeploymentTracking,
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

  public async writeCollectionToJson(outputFolder: string) {
    const collectionPath = path.resolve(
      outputFolder,
      `${defaultCollectionFileName(
        this.opts.apiScenarioFileName,
        this.opts.runId,
        this.opts.apiScenarioName
      )}`
    );
    const envPath = path.resolve(
      outputFolder,
      `${defaultEnvFileName(
        this.opts.apiScenarioFileName,
        this.opts.runId,
        this.opts.apiScenarioName
      )}`
    );
    const env = this.collectionEnv.toJSON();
    env.name = this.opts.apiScenarioFileName + "_env";
    env._postman_variable_scope = "environment";
    await this.fileLoader.writeFile(envPath, JSON.stringify(env, null, 2));
    await this.fileLoader.writeFile(
      collectionPath,
      JSON.stringify(this.collection.toJSON(), null, 2)
    );

    await this.blobUploader.uploadFile(
      "postmancollection",
      `${defaultCollectionFileName(
        this.opts.apiScenarioFileName,
        this.opts.runId,
        this.opts.apiScenarioName
      )}`,
      collectionPath
    );
    const values: string[] = [];
    for (const [k, v] of Object.entries(this.collectionEnv.syncVariablesTo())) {
      if (this.dataMasker.maybeSecretKey(k)) {
        values.push(v as string);
      }
    }
    this.dataMasker.addMaskedValues(values);
    await this.blobUploader.uploadContent(
      "postmancollection",
      `${defaultEnvFileName(
        this.opts.apiScenarioFileName,
        this.opts.runId,
        this.opts.apiScenarioName
      )}`,
      this.dataMasker.jsonStringify(env)
    );

    console.log(`\ngenerate collection successfully!`);
    console.log(`Postman collection: '${collectionPath}'. Postman env: '${envPath}' `);
    console.log(`Command: newman run ${collectionPath} -e ${envPath} -r 'json,cli'`);
  }

  public async runCollection() {
    const reportExportPath = path.resolve(
      this.opts.reportOutputFolder!,
      `${defaultNewmanReport(
        this.opts.apiScenarioFileName,
        this.opts.runId,
        this.opts.apiScenarioName
      )}`
    );
    const runtimeEnvManager = new RuntimeEnvManager(
      path.join(dirname(reportExportPath), this.opts.apiScenarioName),
      this.opts,
      this.collection
    );

    if (this.opts.from) {
      const lastRnv = runtimeEnvManager.loadEnv(this.opts.from);
      this.collectionEnv.syncVariablesFrom(lastRnv);
      // use the variables value which exist in the env.json or process.env
      for (const k of Object.keys(this.collectionEnv.syncVariablesTo())) {
        const v = this.opts.env.get(k);
        if (v?.value) {
          this.collectionEnv.set(k, v.value, typeof v.value);
        }
      }
    }
    if (this.opts.from || this.opts.to) {
      runtimeEnvManager.repopulateCollectionItems(this.opts.from, this.opts.to);
    }
    const newmanRun = async () => {
      return new Promise((resolve) => {
        newman
          .run(
            {
              collection: this.collection,
              environment: this.collectionEnv,
              reporters: ["cli", "json"],
              reporter: { json: { export: reportExportPath } },
            },
            function (err, summary) {
              if (summary.run.failures.length > 0) {
                process.exitCode = 1;
              }
              if (err) {
                console.log(`collection run failed. ${err}`);
              }
              console.log("collection run complete!");
            }
          )
          .on("beforeItem", async function (this: any, _err, _summary) {
            if (!_err) {
              runtimeEnvManager.save(_summary.item.name, this, "beforeStep");
            }
          })
          .on("item", async function (this: any, _err, _summary) {
            if (!_err) {
              runtimeEnvManager.clean();
              runtimeEnvManager.save(_summary.item.name, this, "afterStep");
            }
          })
          .on("done", async (_err, _summary) => {
            const keys = await this.swaggerAnalyzer.getAllSecretKey();
            const values: string[] = [];
            for (const [k, v] of Object.entries(this.collectionEnv.syncVariablesTo())) {
              if (this.dataMasker.maybeSecretKey(k)) {
                values.push(v as string);
              }
            }
            this.dataMasker.addMaskedValues(values);
            this.dataMasker.addMaskedKeys(keys);
            // read content and upload. mask newman report.
            const newmanReport = JSON.parse(
              await this.fileLoader.load(reportExportPath)
            ) as NewmanReport;

            // add mask environment secret value
            for (const item of newmanReport.environment.values) {
              if (this.dataMasker.maybeSecretKey(item.key)) {
                this.dataMasker.addMaskedValues([item.value]);
              }
            }
            if (this.opts.enableBlobUploader) {
              await this.blobUploader.uploadContent(
                "newmanreport",
                `${defaultNewmanReport(
                  this.opts.apiScenarioFileName,
                  this.opts.runId,
                  this.opts.apiScenarioName
                )}`,
                this.dataMasker.jsonStringify(newmanReport)
              );
            }
            const opts: NewmanReportAnalyzerOption = {
              newmanReportFilePath: reportExportPath,
              markdownReportPath: this.opts.markdownReportPath,
              junitReportPath: this.opts.junitReportPath,
              enableUploadBlob: this.opts.enableBlobUploader,
              runId: this.opts.runId,
              swaggerFilePaths: this.opts.swaggerFilePaths,
              validationLevel: this.opts.validationLevel,
              verbose: this.opts.verbose,
            };
            const reportAnalyzer = inversifyGetInstance(NewmanReportAnalyzer, opts);
            await reportAnalyzer.analyze();
            if (this.opts.skipCleanUp || this.opts.to) {
              printWarning(
                `Notice:the resource group '${this.collectionEnv.get(
                  "resourceGroupName"
                )}' was not cleaned up.`
              );
            }
            resolve(_summary);
          });
      });
    };
    await newmanRun();
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
