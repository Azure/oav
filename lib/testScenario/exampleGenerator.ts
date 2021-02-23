import * as fs from "fs";
import * as _ from "lodash";
import { RawReport, RawExecution } from "./testResourceTypes";
/**
 * generate example template from raw report.
 * Compare with raw example template.
 */
export class ExampleGenerator {
  private pollingMap: Map<string, any>;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(private rawReportPath: string, private output: string) {
    this.pollingMap = new Map<string, any>();
  }

  public generateExamples() {
    const rawReport: RawReport = JSON.parse(fs.readFileSync(this.rawReportPath).toString());
    const variables = rawReport.variables;
    const examples: Map<string, any> = new Map<string, any>();
    for (const it of rawReport.executions) {
      if (it.annotation === undefined) {
        continue;
      }
      if (it.annotation.type === "simple" || it.annotation.type === "LRO") {
        const example: any = {};
        example.parameters = this.generateParametersFromQuery(variables, it);
        try {
          _.extend(example.parameters, { parameters: JSON.parse(it.request.body) });
        } catch (err) {}
        const resp: any = this.parseRespBody(it);
        example.responses = {};
        _.extend(example.responses, resp);
        const exampleName = it.annotation.exampleName.replace(/^.*[\\\/]/, "");
        examples.set(it.annotation.poller_item_name.replace("_poller", "") || exampleName, {
          exampleName: exampleName,
          example: example,
        });
      } else if (it.annotation.type === "poller") {
        const resp: any = this.parseRespBody(it);
        this.pollingMap.set(it.annotation.lro_item_name, resp);
      }
    }

    for (const v of examples.values()) {
      fs.writeFileSync(`${this.output}/${v.exampleName}`, JSON.stringify(v.example, null, 2));
    }
  }

  private parseRespBody(it: RawExecution) {
    const resp: any = {};
    try {
      resp[it.response.statusCode] = { body: JSON.parse(it.response.body) };
    } catch (err) {
      resp[it.response.statusCode] = { body: it.response.body };
    }
    return resp;
  }

  private generateParametersFromQuery(variables: any, execution: RawExecution) {
    const ret: any = {};
    for (const [k, v] of Object.entries(variables)) {
      if (typeof v === "string") {
        if (execution.request.url.includes(v as string)) {
          ret[k] = v;
        }
      }
    }
    console.log(ret);
    return ret;
  }
}
