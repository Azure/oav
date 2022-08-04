import { basename } from "path";
import { URL } from "url";
import { HttpMethods } from "@azure/core-http";
import { injectable } from "inversify";
import { Loader } from "../../swagger/loader";
import { RequestTracking, SingleRequestTracking } from "./testRecordingApiScenarioGenerator";

interface RecordingFile {
  Names: { [testName: string]: string[] };
  Variables: { [variableName: string]: string };
  Entries: RecordEntry[];
}

interface RecordEntry {
  RequestUri: string;
  RequestMethod: HttpMethods;
  RequestHeaders: { [headerName: string]: string };
  RequestBody: object | string | null;
  StatusCode: number;
  ResponseHeaders: { [headerName: string]: string };
  ResponseBody: object | string | null;
}

@injectable()
export class TestProxyRecordingLoader implements Loader<RequestTracking, [RecordingFile, string]> {
  public async load([content, filePath]: [RecordingFile, string]): Promise<RequestTracking> {
    const result: RequestTracking = {
      requests: [],
      description: basename(filePath).replace(/\.[^/.]+$/, ""),
    };

    for (const entry of content.Entries) {
      const url = new URL(entry.RequestUri);
      const query: { [key: string]: string } = {};
      url.searchParams.forEach((val, key) => (query[key] = val));

      const request: SingleRequestTracking = {
        method: entry.RequestMethod,
        path: url.pathname,
        url: url.href,
        headers: entry.RequestHeaders,
        query,
        body: entry.RequestBody ?? {},
        responseCode: entry.StatusCode,
        responseHeaders: entry.ResponseHeaders,
        responseBody: entry.ResponseBody,
      };

      result.requests.push(request);
    }

    result.requests.sort((a, b) =>
      new Date(a.responseHeaders.Date) < new Date(b.responseHeaders.Date) ? -1 : 1
    );

    // for (const entry of result.requests) {
    //   console.log(`${entry.method}\t${entry.path}`);
    // }

    return result;
  }
}

export const parseRecordingBodyJson = (content: object | string | null) => {
  if (typeof content !== "string" || content.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(content);
  } catch (e) {
    console.log(`Failed to parse json body. Use string instead: ${JSON.stringify(content)}`);
    return content;
  }
};
