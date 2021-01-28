import { basename } from "path";
import { parse as parseURL } from "url";
import { HttpMethods } from "@azure/core-http";
import { Loader } from "../../swagger/loader";
import { RequestTracking, SingleRequestTracking } from "./testScenarioGenerator";
import { injectable } from "inversify";

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
      const url = parseURL(entry.RequestUri, true);
      if (url.host === undefined) {
        url.host = "https://management.azure.com";
      }

      const request: SingleRequestTracking = {
        method: entry.RequestMethod,
        path: url.path!,
        url: url.href!,
        headers: transformHeaders(entry.RequestHeaders),
        query: url.query as { [key: string]: string },
        responseBody: JSON.parse(entry.ResponseBody),
        responseCode: entry.StatusCode,
        responseHeaders: transformHeaders(entry.ResponseHeaders),
      };

      result.requests.push(request);
    }

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
