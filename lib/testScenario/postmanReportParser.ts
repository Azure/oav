import * as fs from "fs";
import {
  RequestDefinition,
  ResponseDefinition,
  ItemDefinition,
  Request,
  Response,
  DescriptionDefinition,
} from "postman-collection";
import { RawExecution, RawReport, RawRequest, RawResponse } from "./testResourceTypes";

interface PostmanReport {
  run: Run;
  environment: any;
}

interface Run {
  executions: PostmanExecution[];
}

interface PostmanExecution {
  item: ItemDefinition;
  request: RequestDefinition;
  response: ResponseDefinition;
}

export class PostmanReportParser {
  private report: RawReport;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(private reportPath: string, private outputFile: string) {
    this.report = { variables: {}, executions: [] };
  }

  public generateRawReport() {
    const content = fs.readFileSync(this.reportPath).toString();
    const report = JSON.parse(content) as PostmanReport;
    for (const it of report.run.executions) {
      this.report.executions.push(this.generateExampleItem(it));
    }
    this.report.variables = this.parseVariables(report.environment.values);
    fs.writeFileSync(this.outputFile, JSON.stringify(this.report, null, 2));
  }

  private generateExampleItem(it: PostmanExecution): RawExecution {
    const resp = new Response(it.response);
    const req = new Request(it.request);
    const rawReq = this.parseRequest(req);
    const rawResp = this.parseResponse(resp);
    const annotation = JSON.parse((it.item.description as DescriptionDefinition)?.content || "{}");
    return {
      request: rawReq,
      response: rawResp,
      annotation: annotation,
    };
  }

  private parseRequest(req: Request): RawRequest {
    const ret: RawRequest = {
      url: "",
      method: "",
      headers: [],
      body: "",
    };
    ret.url = req.url.getRaw();
    ret.headers = this.parseHeader(req.headers.toJSON());
    ret.method = req.method;
    ret.body = req.body?.toString() || "";
    return ret;
  }

  private parseResponse(resp: Response): RawResponse {
    const ret: RawResponse = {
      headers: [],
      statusCode: "",
      body: "",
    };
    ret.statusCode = resp.code.toString();
    ret.headers = this.parseHeader(resp.headers.toJSON());
    ret.body = resp.body?.toString() || "";
    return ret;
  }

  private parseHeader(headers: any[]) {
    const ret: any = {};
    for (const it of headers) {
      ret[it.key] = it.value;
    }
    return ret;
  }

  private parseVariables(environment: any[]) {
    const ret: any = {};
    for (const it of environment) {
      if (it.type === "string") {
        ret[it.key] = it.value;
      }
    }
    return ret;
  }
}
