import path, { dirname } from "path";
import { inject, injectable } from "inversify";
import newman from "newman";
import {
  Collection,
  Event,
  Header,
  Item,
  QueryParamDefinition,
  Request,
  RequestAuth,
  RequestBody,
  RequestBodyDefinition,
  Url,
  UrlDefinition,
  VariableDefinition,
  VariableScope,
} from "postman-collection";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import { FileLoader } from "../swagger/fileLoader";
import { JsonLoader, JsonLoaderOption } from "../swagger/jsonLoader";
import { setDefaultOpts } from "../swagger/loader";
import { printWarning } from "../util/utils";
import {
  ApiScenarioClientRequest,
  ApiScenarioRunnerClient,
  ArmDeploymentTracking,
  StepEnv,
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
import { PostmanTestScript, TestScriptType } from "./postmanTestScript";
import { ValidationLevel } from "./reportGenerator";
import { RuntimeEnvManager } from "./runtimeEnvManager";
import { SwaggerAnalyzer } from "./swaggerAnalyzer";
import { ReflectiveVariableEnv, VariableEnv } from "./variableEnv";

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

function makeid(length: number): string {
  let text = "";
  const possible = "abcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

export const generateRunId = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear().toString();
  const MM = pad(today.getMonth() + 1, 2);
  const dd = pad(today.getDate(), 2);
  const hh = pad(today.getHours(), 2);
  const mm = pad(today.getMinutes(), 2);
  const id = makeid(5);
  return yyyy + MM + dd + hh + mm + "-" + id;
};

function pad(number: number, length: number) {
  let str = "" + number;
  while (str.length < length) {
    str = "0" + str;
  }
  return str;
}

@injectable()
export class PostmanCollectionRunnerClient implements ApiScenarioRunnerClient {
  public collection: Collection;
  public collectionEnv: VariableScope;
  private postmanTestScript: PostmanTestScript;
  private stepNameSet: Map<string, number>;
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
      baseUrl: "https://management.azure.com",
    });
    this.stepNameSet = new Map<string, number>();
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
      new Event({
        listen: "prerequest",
        script: {
          type: "text/javascript",
          exec: [
            'if (pm.variables.get("enable_auth") !== "true") {',
            '    console.log("Auth disabled");',
            "    return;",
            "}",
            "let vars = ['client_id', 'client_secret', 'tenantId', 'subscriptionId'];",
            "vars.forEach(function (item, index, array) {",
            '    pm.expect(pm.variables.get(item), item + " variable not set").to.not.be.undefined;',
            '    pm.expect(pm.variables.get(item), item + " variable not set").to.not.be.empty; ',
            "});",
            "",
            'if (!pm.collectionVariables.get("bearer_token") || Date.now() > new Date(pm.collectionVariables.get("bearer_token_expires_on") * 1000)) {',
            "    pm.sendRequest({",
            "        url: 'https://login.microsoftonline.com/' + pm.variables.get(\"tenantId\") + '/oauth2/token',",
            "        method: 'POST',",
            "        header: 'Content-Type: application/x-www-form-urlencoded',",
            "        body: {",
            "            mode: 'urlencoded',",
            "            urlencoded: [",
            '                { key: "grant_type", value: "client_credentials", disabled: false },',
            '                { key: "client_id", value: pm.variables.get("client_id"), disabled: false },',
            '                { key: "client_secret", value: pm.variables.get("client_secret"), disabled: false },',
            `                { key: "resource", value: "${this.opts.baseUrl}", disabled: false }`,
            "            ]",
            "        }",
            "    }, function (err, res) {",
            "        if (err) {",
            "            console.log(err);",
            "        } else {",
            "            let resJson = res.json();",
            '            pm.collectionVariables.set("bearer_token_expires_on", resJson.expires_on);',
            '            pm.collectionVariables.set("bearer_token", resJson.access_token);',
            "        }",
            "    });",
            "}",
          ],
        },
      })
    );

    this.collectionEnv = new VariableScope({});
    this.collectionEnv.set("tenantId", this.opts.env.get("tenantId")?.value, "string");
    this.collectionEnv.set("client_id", this.opts.env.get("client_id")?.value, "string");
    this.collectionEnv.set("client_secret", this.opts.env.get("client_secret")?.value, "string");
    this.collectionEnv.set("subscriptionId", this.opts.env.get("subscriptionId")?.value, "string");
    this.collectionEnv.set("location", this.opts.env.get("location")?.value, "string");
    this.postmanTestScript = new PostmanTestScript();
  }

  public async startTestProxyRecording(): Promise<void> {
    if (!this.opts.testProxy) {
      return;
    }
    const item = new Item({
      name: "startTestProxyRecording",
      request: {
        url: `${this.opts.testProxy}/record/start`,
        method: "post",
        body: {
          mode: "raw",
          raw: `{"x-recording-file": "./recordings/${this.opts.apiScenarioName}_${this.opts.runId}.json"}`,
        },
      },
    });
    item.events.add(
      new Event({
        listen: "test",
        script: {
          type: "text/javascript",
          exec: `
          pm.test("Started TestProxy recording", function(){
              pm.response.to.be.success;
              pm.response.to.have.header('x-recording-id');
              pm.collectionVariables.set('x_recording_id', pm.response.headers.get('x-recording-id'));
          });
          `,
        },
      })
    );
    this.collection.items.add(item);
  }

  public async stopTestProxyRecording(): Promise<void> {
    if (!this.opts.testProxy) {
      return;
    }
    const item = new Item({
      name: "stopTestProxyRecording",
      request: {
        url: `${this.opts.testProxy}/record/stop`,
        method: "post",
      },
    });
    item.request.addHeader({
      key: "x-recording-id",
      value: "{{x_recording_id}}",
    });
    item.events.add(
      new Event({
        listen: "test",
        script: {
          type: "text/javascript",
          exec: `
          pm.test("Stopped TestProxy recording", function(){
              pm.response.to.be.success;
          });
          `,
        },
      })
    );
    this.collection.items.add(item);
  }

  public async createResourceGroup(
    subscriptionId: string,
    resourceGroupName: string,
    location: string
  ): Promise<void> {
    const item = new Item({
      name: "createResourceGroup",
      request: {
        url: `${
          this.opts.testProxy ?? this.opts.baseUrl
        }/subscriptions/{{subscriptionId}}/resourcegroups/{{resourceGroupName}}?api-version=2020-06-01`,
        method: "put",
        body: {
          mode: "raw",
          raw: '{"location":"{{location}}"}',
        },
      },
    });
    item.description = typeToDescription({ type: "prepare" });

    item.request.addHeader({ key: "Content-Type", value: "application/json" });
    if (this.opts.testProxy) {
      item.request.addHeader({ key: "x-recording-upstream-base-uri", value: this.opts.baseUrl });
      item.request.addHeader({ key: "x-recording-id", value: "{{x_recording_id}}" });
      item.request.addHeader({ key: "x-recording-mode", value: "record" });
    }

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
    const item = new Item({
      name: "deleteResourceGroup",
      request: {
        url: `${
          this.opts.testProxy ?? this.opts.baseUrl
        }/subscriptions/{{subscriptionId}}/resourcegroups/{{resourceGroupName}}?api-version=2020-06-01`,
        method: "delete",
      },
    });
    item.request.addHeader({ key: "Content-Type", value: "application/json" });
    if (this.opts.testProxy) {
      item.request.addHeader({ key: "x-recording-upstream-base-uri", value: this.opts.baseUrl });
      item.request.addHeader({ key: "x-recording-id", value: "{{x_recording_id}}" });
      item.request.addHeader({ key: "x-recording-mode", value: "record" });
    }

    item.events.add(
      new Event({
        listen: "test",
        script: {
          type: "text/javascript",
          exec: this.postmanTestScript.generateScript({
            name: "response code should be 2xx",
            types: ["StatusCodeAssertion"],
          }),
        },
      })
    );

    this.addAsLongRunningOperationItem(item);
  }

  private convertString(source: string): string {
    const regex = /\$\(([A-Za-z_][A-Za-z0-9_]*)\)/;
    if (regex.test(source)) {
      const globalRegex = new RegExp(regex, "g");
      let match;
      while ((match = globalRegex.exec(source))) {
        source =
          source.substring(0, match.index) +
          `{{${match[1]}}}` +
          source.substring(match.index + match[0].length);
      }
    }
    return source;
  }

  private convertPostmanFormat<T>(obj: T, convertString: (s: string) => string): T {
    if (typeof obj === "string") {
      return convertString(obj) as unknown as T;
    }
    if (typeof obj !== "object") {
      return obj;
    }
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return (obj as any[]).map((v) => this.convertPostmanFormat(v, convertString)) as unknown as T;
    }

    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = this.convertPostmanFormat((obj as any)[key], convertString);
    }
    return result;
  }

  public async sendRestCallRequest(
    _: ApiScenarioClientRequest,
    step: StepRestCall,
    stepEnv: StepEnv
  ): Promise<void> {
    const pathEnv = new ReflectiveVariableEnv(":", "");
    const item = new Item();
    if (!this.stepNameSet.has(step.step!)) {
      item.name = step.step!;
      this.stepNameSet.set(step.step, 0);
    } else {
      const cnt = this.stepNameSet.get(step.step!)! + 1;
      item.name = `${step.step}_${cnt}`;
      this.stepNameSet.set(step.step, cnt);
    }
    item.request = new Request({
      name: step.step,
      method: step.operation._method as string,
      url: "",
      body: { mode: "raw" } as RequestBodyDefinition,
    });
    item.description = step.operation.operationId || "";
    const queryParams: QueryParamDefinition[] = [];
    const urlVariables: VariableDefinition[] = [];
    for (const p of step.operation.parameters ?? []) {
      const param = this.opts.jsonLoader!.resolveRefObj(p);
      const paramValue = this.convertPostmanFormat(
        step.requestParameters[param.name],
        this.convertString
      );
      const paramName = Object.keys(step.variables).includes(param.name)
        ? `${item.name}_${param.name}`
        : param.name;

      if (paramName !== param.name) {
        step.responseExpected = this.convertPostmanFormat(step.responseExpected, (s) =>
          s.replace(`$(${param.name})`, `$(${paramName})`)
        );
      }

      switch (param.in) {
        case "path":
          urlVariables.push({ key: param.name, value: `{{${paramName}}}` });
          break;
        case "query":
          if (paramValue !== undefined) {
            queryParams.push({ key: param.name, value: paramValue });
          }
          break;
        case "header":
          const header = new Header({ key: param.name, value: paramValue });
          item.request.headers.add(header);
          break;
        case "body":
          item.request.body = new RequestBody({
            mode: "raw",
            raw: JSON.stringify(paramValue, null, 2),
          });
          break;
        default:
          throw new Error(`Parameter "in" not supported: ${param.in}`);
      }
      this.collection.items.add(item);
    }

    stepEnv.env.resolve();
    for (const p of step.operation.parameters ?? []) {
      const param = this.opts.jsonLoader!.resolveRefObj(p);
      const paramValue = stepEnv.env.get(param.name)?.value;
      if (!paramValue) {
        continue;
      }

      const paramName = Object.keys(step.variables).includes(param.name)
        ? `${item.name}_${param.name}`
        : param.name;
      if (!this.collectionEnv.has(paramName)) {
        this.collectionEnv.set(paramName, paramValue, typeof paramValue);
      }
    }

    stepEnv.env.getKeyList().forEach((key) => {
      if (Object.keys(step.variables).includes(key)) {
        return;
      }

      if (!this.collectionEnv.has(key)) {
        this.collectionEnv.set(
          key,
          stepEnv.env.get(key)?.value,
          typeof stepEnv.env.get(key)?.value
        );
      }
    });

    item.request.addHeader({ key: "Content-Type", value: "application/json" });
    if (this.opts.testProxy) {
      item.request.addHeader({ key: "x-recording-upstream-base-uri", value: this.opts.baseUrl });
      item.request.addHeader({ key: "x-recording-id", value: "{{x_recording_id}}" });
      item.request.addHeader({ key: "x-recording-mode", value: "record" });
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
      stepEnv.env.output(outputName, {
        type: "string",
        value: `{{${outputName}}}`,
      });
    }
    const scriptTypes: TestScriptType[] = this.opts.verbose
      ? ["DetailResponseLog", "StatusCodeAssertion"]
      : ["StatusCodeAssertion"];
    this.addTestScript(item, scriptTypes, getOverwriteVariables());
    item.request.url = new Url({
      path: pathEnv.resolveString(step.operation._path._pathTemplate, true),
      host: this.opts.testProxy ?? this.opts.baseUrl,
      variable: urlVariables,
    } as UrlDefinition);
    item.request.addQueryParams(queryParams);

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
          item.request.url.toString(),
          item.name,
          step.operation._method
        )
      );
    }
  }

  private addAsLongRunningOperationItem(item: Item, checkStatus: boolean = false) {
    const longRunningEvent = new Event({
      listen: "test",
      script: {
        type: "text/javascript",
        exec: `
        const pollingUrl = pm.response.headers.get('Location') || pm.response.headers.get('Azure-AsyncOperation');
        if (pollingUrl) {
          pm.collectionVariables.set("x_polling_url", ${
            this.opts.testProxy
              ? `pollingUrl.replace("${this.opts.baseUrl}","${this.opts.testProxy}")`
              : "pollingUrl"
          });
      }
        `,
      },
    });
    item.events.add(longRunningEvent);
    this.collection.items.add(item);
    for (const it of this.longRunningOperationItem(item, checkStatus)) {
      this.collection.items.append(it);
    }
  }

  private addTestScript(
    item: Item,
    types: TestScriptType[] = ["StatusCodeAssertion"],
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
    const testEvent = new Event({
      listen: "test",
      script: {
        type: "text/javascript",
        // generate assertion from example
        exec: this.postmanTestScript.generateScript({
          name: "response status code assertion.",
          types: types,
          variables: overwriteVariables,
          armTemplate,
        }),
      },
    });
    item.events.add(testEvent);
  }

  public async sendArmTemplateDeployment(
    armTemplate: ArmTemplate,
    _armDeployment: ArmDeploymentTracking,
    step: StepArmTemplate,
    stepEnv: StepEnv
  ): Promise<void> {
    const item = new Item();
    item.name = step.step;
    const path = `/subscriptions/{{subscriptionId}}/resourcegroups/{{resourceGroupName}}/providers/Microsoft.Resources/deployments/${step.step}?api-version=2020-06-01`;

    const subscriptionIdValue = covertToPostmanVariable(
      stepEnv.env.resolveString(stepEnv.env.getString("subscriptionId") || "")
    );
    const resourceGroupNameValue = covertToPostmanVariable(
      stepEnv.env.resolveString(stepEnv.env.getString("resourceGroupName") || "")
    );
    const subscriptionIdParamName = Object.keys(step.variables).includes("subscriptionId")
      ? `${item.name}_subscriptionId`
      : "subscriptionId";
    const resourceGroupNameParamName = Object.keys(step.variables).includes("resourceGroupName")
      ? `${item.name}_resourceGroupName`
      : "resourceGroupName";
    const urlVariables: VariableDefinition[] = [
      { key: "subscriptionId", value: `{{${subscriptionIdParamName}}}` },
      { key: "resourceGroupName", value: `{{${resourceGroupNameParamName}}}` },
    ];

    if (!this.collectionEnv.has(subscriptionIdParamName)) {
      this.collectionEnv.set(
        subscriptionIdParamName,
        subscriptionIdValue,
        typeof subscriptionIdValue
      );
    }

    if (!this.collectionEnv.has(resourceGroupNameParamName)) {
      this.collectionEnv.set(
        resourceGroupNameParamName,
        resourceGroupNameValue,
        typeof resourceGroupNameValue
      );
    }

    item.request = new Request({
      name: step.step,
      method: "put",
      url: "",
      body: { mode: "raw" } as RequestBodyDefinition,
    });
    item.request.url = new Url({
      host: this.opts.testProxy ?? this.opts.baseUrl,
      path: path,
      variable: urlVariables,
    });
    const body = {
      properties: {
        mode: "Incremental",
        template: this.convertPostmanFormat(
          stepEnv.env.resolveObjectValues(armTemplate),
          this.convertString
        ),
      },
    };
    for (const outputName of Object.keys(step.armTemplatePayload.outputs || {})) {
      stepEnv.env.output(outputName, {
        type: "string",
        value: `{{${outputName}}}`,
      });
    }
    item.request.body = new RequestBody({
      mode: "raw",
      raw: JSON.stringify(body, null, 2),
    });
    item.request.addHeader({ key: "Content-Type", value: "application/json" });
    if (this.opts.testProxy) {
      item.request.addHeader({ key: "x-recording-upstream-base-uri", value: this.opts.baseUrl });
      item.request.addHeader({ key: "x-recording-id", value: "{{x_recording_id}}" });
      item.request.addHeader({ key: "x-recording-mode", value: "record" });
    }
    const scriptTypes: TestScriptType[] = this.opts.verbose
      ? ["StatusCodeAssertion", "DetailResponseLog"]
      : ["StatusCodeAssertion"];
    item.events.add(
      new Event({
        listen: "test",
        script: {
          type: "text/javascript",
          exec: this.postmanTestScript.generateScript({
            name: "response status code assertion.",
            types: scriptTypes,
            variables: undefined,
          }),
        },
      })
    );
    this.collection.items.add(item);
    this.addAsLongRunningOperationItem(item, true);
    const generatedGetScriptTypes: TestScriptType[] = this.opts.verbose
      ? ["DetailResponseLog", "ExtractARMTemplateOutput"]
      : ["ExtractARMTemplateOutput"];
    const generatedGetOperationItem = this.generatedGetOperationItem(
      item.name,
      item.request.url.toString(),
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
    url: string,
    step: string,
    prevMethod: string = "put",
    scriptTypes: TestScriptType[] = [],
    armTemplate?: ArmTemplate
  ): Item {
    const item = new Item({
      name: `${generatedPostmanItem(generatedGet(name))}`,
      request: {
        method: "get",
        url: url,
      },
    });
    item.description = typeToDescription({
      type: "generated-get",
      lro_item_name: name,
      step: step,
    });
    item.request.addHeader({ key: "Content-Type", value: "application/json" });
    if (this.opts.testProxy) {
      item.request.addHeader({ key: "x-recording-upstream-base-uri", value: this.opts.baseUrl });
      item.request.addHeader({ key: "x-recording-id", value: "{{x_recording_id}}" });
      item.request.addHeader({ key: "x-recording-mode", value: "record" });
    }
    if (prevMethod !== "delete") {
      scriptTypes.push("StatusCodeAssertion");
    }
    this.addTestScript(item, scriptTypes, undefined, armTemplate);
    return item;
  }

  public longRunningOperationItem(initialItem: Item, checkStatus: boolean = false): Item[] {
    const ret: Item[] = [];

    const pollerItemName = generatedPostmanItem(initialItem.name + "_poller");
    const pollerItem = new Item({
      name: pollerItemName,
      request: {
        url: `{{x_polling_url}}`,
        method: "get",
      },
    });
    if (this.opts.testProxy) {
      pollerItem.request.addHeader({
        key: "x-recording-upstream-base-uri",
        value: this.opts.baseUrl,
      });
      pollerItem.request.addHeader({ key: "x-recording-id", value: "{{x_recording_id}}" });
      pollerItem.request.addHeader({ key: "x-recording-mode", value: "record" });
    }
    pollerItem.description = typeToDescription({ type: "poller", lro_item_name: initialItem.name });

    const delay = this.mockDelayItem(pollerItem.name, initialItem.name);

    const event = new Event({
      listen: "test",
      script: {
        type: "text/javascript",
        exec: `
      try{
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
      }`,
      },
    });
    pollerItem.events.add(event);

    if (checkStatus) {
      const checkStatusEvent = new Event({
        listen: "test",
        script: {
          type: "text/javascript",
          exec: this.postmanTestScript.generateScript({
            name: "armTemplate deployment status check",
            types: ["StatusCodeAssertion", "ARMDeploymentStatusAssertion"],
          }),
        },
      });
      pollerItem.events.add(checkStatusEvent);
    }

    ret.push(pollerItem);
    ret.push(delay);
    return ret;
  }

  public mockDelayItem(nextRequestName: string, LROItemName: string): Item {
    const ret = new Item({
      name: `${nextRequestName}_mock_delay`,
      request: {
        url: "https://postman-echo.com/delay/10",
        method: "get",
      },
    });

    ret.description = typeToDescription({ type: "mock", lro_item_name: LROItemName });
    const event = new Event({
      listen: "prerequest",
      script: {
        type: "text/javascript",
        exec: `postman.setNextRequest('${nextRequestName}')`,
      },
    });
    ret.events.add(event);
    return ret;
  }
}

const covertToPostmanVariable = (value: string): string => {
  return value.replace("$(", "{{").replace(")", "}}");
};
