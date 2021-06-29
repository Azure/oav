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

export interface NewmanReport {
  run: Run;
  environment: any;
  collection: any;
}

interface Run {
  executions: NewmanExecution[];
  timings: { started: number; completed: number; responseAverage: number };
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
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: NewmanReportParserOption,
    private fileLoader: FileLoader
  ) {}

  public async generateRawReport(newmanReportFilePath: string) {
    const ret: RawReport = { variables: {}, executions: [], timings: {}, metadata: {} };
    const content = await this.fileLoader.load(newmanReportFilePath);
    const newmanReport = JSON.parse(content) as NewmanReport;
    ret.metadata = JSON.parse(newmanReport.collection.info.description.content);
    for (const it of newmanReport.run.executions) {
      ret.executions.push(this.generateExampleItem(it));
    }
    ret.timings = newmanReport.run.timings;
    ret.variables = this.parseVariables(newmanReport.environment.values);
    if (this.opts.reportOutputFilePath !== undefined) {
      await this.fileLoader.writeFile(this.opts.reportOutputFilePath, JSON.stringify(ret, null, 2));
    }
    return ret;
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
    ret.url = req.url.toString();
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
