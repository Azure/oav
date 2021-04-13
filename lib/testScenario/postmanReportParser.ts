import { inject, injectable } from "inversify";
import {
  RequestDefinition,
  ResponseDefinition,
  ItemDefinition,
  Request,
  Response,
  DescriptionDefinition,
} from "postman-collection";
import { FileLoader, FileLoaderOption } from "./../swagger/fileLoader";
import { TYPES } from "./../inversifyUtils";
import { RawExecution, RawReport, RawRequest, RawResponse } from "./testResourceTypes";

interface NewmanReport {
  run: Run;
  environment: any;
  collection: any;
}

interface Run {
  executions: NewmanExecution[];
}

interface NewmanExecution {
  item: ItemDefinition;
  request: RequestDefinition;
  response: ResponseDefinition;
}

export interface NewmanReportParserOption extends FileLoaderOption {
  newmanReportFilePath: string;
  reportOutputFilePath?: string;
}

@injectable()
export class NewmanReportParser {
  private report: RawReport;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: NewmanReportParserOption,
    private fileLoader: FileLoader
  ) {
    this.report = { variables: {}, executions: [], metadata: {} };
  }

  public async generateRawReport() {
    const content = await this.fileLoader.load(this.opts.newmanReportFilePath);
    const report = JSON.parse(content) as NewmanReport;
    this.report.metadata.testScenarioFilePath = report.collection.info.description.content; // JSON.parse(report.collection.description.content);
    for (const it of report.run.executions) {
      this.report.executions.push(this.generateExampleItem(it));
    }
    this.report.variables = this.parseVariables(report.environment.values);
    if (this.opts.reportOutputFilePath !== undefined) {
      await this.fileLoader.writeFile(
        this.opts.reportOutputFilePath,
        JSON.stringify(this.report, null, 2)
      );
    }
    return this.report;
  }

  private generateExampleItem(it: NewmanExecution): RawExecution {
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
      statusCode: resp.code,
      body: "",
    };
    ret.headers = this.parseHeader(resp.headers.toJSON());

    ret.body = resp.stream?.toString() || "";
    return ret;
  }

  private parseHeader(headers: any[]) {
    const ret: any = {};
    for (const it of headers) {
      ret[it.key] = it.value;

      // Currently only mask bearer token header.
      // For further sensitive data, should add mask module here
      if (it.key === "Authorization") {
        ret[it.key] = "<bearer token>";
      }
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
