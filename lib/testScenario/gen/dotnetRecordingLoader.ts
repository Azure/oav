import { basename } from "path";
import { HttpMethods } from "@azure/core-http";
import { injectable } from "inversify";
import { Loader } from "../../swagger/loader";
import { RequestTracking, SingleRequestTracking } from "./testScenarioGenerator";

interface RecordingFile {
  Names: { [testName: string]: string[] };
  Variables: { [variableName: string]: string };
  Entries: RecordingEntry[];
}

interface RecordingEntry {
  RequestUri: string;
  EncodedRequestUri: string;
  RequestMethod: HttpMethods;
  RequestBody: string;
  RequestHeaders: { [headerName: string]: string[] };
  ResponseHeaders: { [headerName: string]: string[] };
  ResponseBody: string;
  StatusCode: number;
}

@injectable()
export class DotnetReordingLoader implements Loader<RequestTracking, [RecordingFile, string]> {
  public async load([content, filePath]: [RecordingFile, string]): Promise<RequestTracking> {
    const result: RequestTracking = {
      requests: [],
      description: basename(filePath).replace(/\.[^/.]+$/, ""),
    };

    for (const entry of content.Entries) {
      const url = new URL(entry.RequestUri, "https://management.azure.com");
      const query: { [key: string]: string } = {};
      url.searchParams.forEach((val, key) => (query[key] = val));

      const request: SingleRequestTracking = {
        method: entry.RequestMethod,
        path: url.pathname,
        url: url.href,
        headers: transformHeaders(entry.RequestHeaders),
        query,
        body: parseJson(entry.RequestBody) ?? {},
        responseBody: parseJson(entry.ResponseBody),
        responseCode: entry.StatusCode,
        responseHeaders: transformHeaders(entry.ResponseHeaders),
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

const transformHeaders = (headers: { [headerName: string]: string[] }) => {
  const result: { [headerName: string]: string } = {};
  for (const headerName of Object.keys(headers)) {
    result[headerName] = headers[headerName].join(" ");
  }
  return result;
};

const parseJson = (content: string) => {
  if (content.length === 0) {
    return undefined;
  }
  return JSON.parse(content);
};