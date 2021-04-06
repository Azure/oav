import path from "path";
import fs from "fs";
import newman from "newman";
import {
  VariableScope,
  Collection,
  Header,
  Item,
  Request,
  RequestBody,
  RequestBodyDefinition,
  Url,
  UrlDefinition,
  Event,
  QueryParamDefinition,
  VariableDefinition,
  ItemDefinition,
} from "postman-collection";

import { JsonLoader } from "../swagger/jsonLoader";
import { PostmanTestScript, TestScriptType } from "./postmanTestScript";
import { ArmTemplate, TestStepArmTemplateDeployment, TestStepRestCall } from "./testResourceTypes";
import {
  ArmDeploymentTracking,
  TestScenarioClientRequest,
  TestScenarioRunnerClient,
  TestStepEnv,
} from "./testScenarioRunner";
import { ReflectiveVariableEnv, VariableEnv } from "./variableEnv";
import { typeToDescription } from "./postmanItemTypes";
import { generatedGet, lroPollingUrl, generatedPrefix } from "./postmanItemNaming";

export class PostmanCollectionRunnerClient implements TestScenarioRunnerClient {
  public collection: Collection;
  public collectionEnv: VariableScope;
  private postmanTestScript: PostmanTestScript;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    private name: string,
    private jsonLoader: JsonLoader,
    private env: VariableEnv,
    private testScenarioFilePath?: string
  ) {
    this.collection = new Collection();
    //TODO: Add testScenarioFilePath as metadata
    this.collection.name = this.testScenarioFilePath || name;
    this.collectionEnv = new VariableScope({});
    this.collectionEnv.set("bearerToken", "<bearerToken>", "string");
    this.postmanTestScript = new PostmanTestScript();
  }
  public async createResourceGroup(
    subscriptionId: string,
    resourceGroupName: string,
    location: string
  ): Promise<void> {
    this.auth(this.env);
    const item = new Item({
      name: "createResourceGroup",
      request: {
        url: `https://management.azure.com/subscriptions/${subscriptionId}/resourcegroups/{{resourceGroupName}}?api-version=2020-06-01`,
        method: "put",
        body: {
          mode: "raw",
          raw: JSON.stringify({ location: location }),
        },
      },
    });
    item.description = typeToDescription({ type: "prepare" });
    const authorizationHeader = new Header({
      key: "Authorization",
      value: `Bearer {{bearerToken}}`,
    });
    item.request.addHeader(new Header({ key: "Content-Type", value: "application/json" }));
    item.request.addHeader(authorizationHeader);
    this.addTestScript(item);
    this.collection.items.add(item);
    this.collectionEnv.set("resourceGroupName", resourceGroupName, "string");
  }
  public async deleteResourceGroup(
    subscriptionId: string,
    _resourceGroupName: string
  ): Promise<void> {
    const item = new Item({
      name: "deleteResourceGroup",
      request: {
        url: `https://management.azure.com/subscriptions/${subscriptionId}/resourcegroups/{{resourceGroupName}}?api-version=2020-06-01`,
        method: "delete",
      },
    });
    const authorizationHeader = new Header({
      key: "Authorization",
      value: `Bearer {{bearerToken}}`,
    });
    item.request.addHeader(new Header({ key: "Content-Type", value: "application/json" }));
    item.request.addHeader(authorizationHeader);
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
    // delete resource group is long running operation
    this.addAsLongRunningOperationItem(item);
  }

  public async sendExampleRequest(
    request: TestScenarioClientRequest,
    step: TestStepRestCall,
    stepEnv: TestStepEnv
  ): Promise<void> {
    this.auth(stepEnv.env);
    const pathEnv = new ReflectiveVariableEnv(":", "");
    const item = new Item();
    item.name = step.step!;
    item.request = new Request({
      name: step.exampleFilePath,
      method: step.operation._method as string,
      url: "",
      body: { mode: "raw" } as RequestBodyDefinition,
    });
    item.description = step.operation.operationId || "";
    const queryParams: QueryParamDefinition[] = [];
    const urlVariables: VariableDefinition[] = [];
    for (const p of step.operation.parameters ?? []) {
      const param = this.jsonLoader.resolveRefObj(p);
      const paramValue = stepEnv.env.get(param.name) || step.requestParameters[param.name];
      if (!this.collectionEnv.has(param.name)) {
        this.collectionEnv.set(param.name, paramValue, typeof step.requestParameters[param.name]);
      }

      switch (param.in) {
        case "path":
          urlVariables.push({ key: param.name, value: `{{${param.name}}}` });
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
            raw: JSON.stringify(stepEnv.env.resolveObjectValues(request.body), null, 2),
          });
          break;
        default:
          throw new Error(`Parameter "in" not supported: ${param.in}`);
      }
      this.collection.items.add(item);
    }
    const authorizationHeader = new Header({
      key: "Authorization",
      value: `Bearer {{bearerToken}}`,
    });
    const contentType = new Header({ key: "Content-Type", value: "application/json" });
    item.request.addHeader(contentType);
    item.request.addHeader(authorizationHeader);

    // store example variable. generate auto validation
    this.addTestScript(item);
    item.request.url = new Url({
      path: pathEnv.resolveString(step.operation._path._pathTemplate, "{", "}"),
      host: "https://management.azure.com",
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
        step: step.step,
      });
      this.addAsLongRunningOperationItem(item);
    } else {
      item.description = typeToDescription({
        type: "simple",
        operationId: step.operation.operationId || "",
        exampleName: step.exampleFile!,
        itemName: item.name,
        step: step.step,
      });
      this.collection.items.add(item);
    }
    // generate get
    if (step.operation._method === "put" || step.operation._method === "delete") {
      this.collection.items.add(
        this.generatedGetOperationItem(
          item.name,
          item.request.url.toString(),
          step.step,
          step.operation._method
        )
      );
    }
  }

  private addAsLongRunningOperationItem(item: Item) {
    this.collectionEnv.set(`${lroPollingUrl(item.name)}`, "<polling_url>", "string");
    const longRunningEvent = new Event({
      listen: "test",
      script: {
        type: "text/javascript",
        exec: `pm.environment.set("${lroPollingUrl(
          item.name
        )}", pm.response.headers.get('Location')||pm.response.headers.get('Azure-AsyncOperation')||"https://postman-echo.com/delay/10")`,
      },
    });
    item.events.add(longRunningEvent);
    this.collection.items.add(item);
    for (const it of this.longRunningOperationItem(item)) {
      this.collection.items.append(it);
    }
  }

  private addTestScript(
    item: Item,
    types: TestScriptType[] = ["DetailResponseLog", "StatusCodeAssertion"],
    overwriteVariables?: Map<string, string>
  ) {
    if (overwriteVariables !== undefined) {
      types.push("OverwriteVariables");
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
        }),
      },
    });
    item.events.add(testEvent);
  }

  public async sendArmTemplateDeployment(
    armTemplate: ArmTemplate,
    params: { [name: string]: string },
    _armDeployment: ArmDeploymentTracking,
    step: TestStepArmTemplateDeployment,
    stepEnv: TestStepEnv
  ): Promise<void> {
    this.auth(stepEnv.env);
    const item = new Item();
    item.name = step.armTemplateDeployment;
    const path =
      "/subscriptions/:subscriptionId/resourcegroups/:resourceGroupName/providers/Microsoft.Resources/deployments/{{deploymentName}}?api-version=2020-06-01";
    const urlVariables: VariableDefinition[] = [
      { key: "subscriptionId", value: "{{subscriptionId}}" },
      { key: "resourceGroupName", value: "{{resourceGroupName}}" },
    ];
    this.collectionEnv.set("deploymentName", stepEnv.env.get("deploymentName"), "string");
    item.request = new Request({
      name: step.armTemplateDeployment,
      method: "put",
      url: "",
      body: { mode: "raw" } as RequestBodyDefinition,
    });
    item.request.url = new Url({
      host: "https://management.azure.com",
      path: path,
      variable: urlVariables,
    });
    const body = {
      properties: {
        mode: "Complete",
        template: armTemplate,
        parameters: params,
      },
    };
    item.request.body = new RequestBody({
      mode: "raw",
      raw: JSON.stringify(body, null, 2),
    });
    this.addAuthorizationHeader(item);
    item.events.add(
      new Event({
        listen: "test",
        script: {
          type: "text/javascript",
          exec: `pm.test("Status code is 200", function () {
          console.log(pm.response.text())
          pm.response.to.have.status(200);
      });
      `,
        },
      })
    );
    this.collection.items.add(item);
  }

  private addAuthorizationHeader(item: Item) {
    const authorizationHeader = new Header({
      key: "Authorization",
      value: `Bearer {{bearerToken}}`,
    });
    const contentType = new Header({ key: "Content-Type", value: "application/json" });
    item.request.addHeader(contentType);
    item.request.addHeader(authorizationHeader);
  }

  private auth(env: VariableEnv) {
    if (this.collection.items.count() === 0) {
      this.collection.items.add(this.aadAuthAccessTokenItem(env));
    }
  }

  public writeCollectionToJson(outputFolder: string) {
    const collectionPath = path.resolve(outputFolder, `${this.name}_collection.json`);
    const envPath = path.resolve(outputFolder, `${this.name}_env.json`);
    fs.writeFileSync(collectionPath, JSON.stringify(this.collection.toJSON(), null, 2));
    const env = this.collectionEnv.toJSON();
    env.name = this.name + "_env";
    env._postman_variable_scope = "environment";
    fs.writeFileSync(envPath, JSON.stringify(env, null, 2));

    console.log("\ngenerate collection successfully!");
    console.log(`Postman collection: '${collectionPath}'. Postman env: '${envPath}' `);
    console.log(`Command: newman run ${collectionPath} -e ${envPath} -r 'json,cli'`);
  }

  public async runCollection() {
    newman.run(
      { collection: this.collection, environment: this.collectionEnv, reporters: "cli" },
      function (_err, summary: newman.NewmanRunSummary) {
        if (summary.run.failures.length === 0) {
          fs.appendFileSync("/home/ruowan/work/oav/res.txt", summary.collection.name);
        }
        if (summary.run.failures) {
          console.log("failed");
        }
        console.log(summary);
        console.log("collection run complete!");
      }
    );
  }

  private generatedGetOperationItem(
    name: string,
    url: string,
    step: string,
    prevMethod: string = "put"
  ): Item {
    const item = new Item({
      name: `${generatedPrefix(generatedGet(name))}`,
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
    this.addAuthorizationHeader(item);
    const scriptTypes: TestScriptType[] = ["DetailResponseLog"];
    if (prevMethod !== "delete") {
      scriptTypes.push("StatusCodeAssertion");
    }
    this.addTestScript(item, scriptTypes);
    return item;
  }

  public longRunningOperationItem(initialItem: Item): Item[] {
    const ret: Item[] = [];
    const pollerItemName = generatedPrefix(initialItem.name + "_poller");
    const pollerItem = new Item({
      name: pollerItemName,
      request: {
        url: `{{${initialItem.name}_polling_url}}`,
        method: "get",
        header: [{ key: "Authorization", value: "Bearer {{bearerToken}}" }],
      },
    });
    pollerItem.description = typeToDescription({ type: "poller", lro_item_name: initialItem.name });
    const delay = this.mockDelayItem(pollerItem.name, initialItem.name);
    const event = new Event({
      listen: "test",
      script: {
        type: "text/javascript",
        exec: `
      try{
        if(pm.response.code===202){
          postman.setNextRequest('${delay.name}')
        }else if(pm.response.code==204){
          postman.setNextRequest($(nextRequest))
        }
        else{
          console.log(pm.response.text())
          const terminalStatus = ["Succeeded", "Failed", "Canceled"]
          if(pm.response.json().status!==undefined&&terminalStatus.indexOf(pm.response.json().status)===-1){
            postman.setNextRequest('${delay.name}')
          }else{
            postman.setNextRequest($(nextRequest))
          }
        }
      }catch(err){
        console.log(err)
        postman.setNextRequest($(nextRequest))
      }`,
      },
    });
    pollerItem.events.add(event);

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
  public aadAuthAccessTokenItem(env: VariableEnv): Item {
    const urlVariables: VariableDefinition[] = [{ key: "tenantId", value: "{{tenantId}}" }];
    const ret = new Item({
      name: "get Azure AAD Token",
    } as ItemDefinition);
    ret.request = new Request({
      method: "post",
      url: "",
      body: {
        mode: "urlencoded",
        urlencoded: [
          { key: "grant_type", value: "client_credentials" },
          { key: "client_id", value: "{{client_id}}" },
          { key: "client_secret", value: "{{client_secret}}" },
          { key: "resource", value: "https://management.azure.com" },
        ] as QueryParamDefinition[],
      },
    });
    ret.request.url = new Url({
      path: "/:tenantId/oauth2/token",
      host: "https://login.microsoftonline.com",
      variable: urlVariables,
    } as UrlDefinition);
    this.collectionEnv.set("tenantId", env.get("tenantId"), "string");
    this.collectionEnv.set("client_id", env.get("client_id"), "string");
    this.collectionEnv.set("client_secret", env.get("client_secret"), "string");
    this.collectionEnv.set("resourceGroupName", env.get("resourceGroupName"), "string");
    ret.events.add(
      new Event({
        listen: "test",
        script: {
          type: "text/javascript",
          exec: this.postmanTestScript.generateScript({
            name: "AAD auth should be successful",
            types: ["DetailResponseLog", "ResponseDataAssertion", "OverwriteVariables"],
            variables: new Map<string, string>([["bearerToken", "access_token"]]),
          }),
        },
      })
    );
    return ret;
  }
}
