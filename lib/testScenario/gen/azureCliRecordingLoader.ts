import { basename } from "path";
import { HttpMethods } from "@azure/core-http";
import { injectable } from "inversify";
import { Loader } from "../../swagger/loader";
import { RequestTracking, SingleRequestTracking } from "./testScenarioGenerator";
import { parseRecordingBodyJson, transformRecordingHeaders } from "./dotnetRecordingLoader";

interface RecordingFile {
  interactions: RecordingEntry[];
}

interface RecordingEntry {
  request: {
    body: string | null;
    headers: { [headerName: string]: string[] };
    method: HttpMethods;
    uri: string;
  };
  response: {
    body: {
      string?: string;
    };
    headers: { [headerName: string]: string[] };
    status: {
      code: number;
      message: string;
    };
  };
}

@injectable()
export class AzureCliRecordingLoader implements Loader<RequestTracking, [RecordingFile, string]> {
  public async load([content, filePath]: [RecordingFile, string]): Promise<RequestTracking> {
    const result: RequestTracking = {
      requests: [],
      description: basename(filePath).replace(/\.[^/.]+$/, ""),
    };

    for (const entry of content.interactions) {
      const url = new URL(entry.request.uri, "https://management.azure.com");
      const query: { [key: string]: string } = {};
      url.searchParams.forEach((val, key) => (query[key] = val));

      const responseHeaders = transformRecordingHeaders(entry.response.headers);
      if (responseHeaders["content-type"] === "application/xml") {
        console.log(`SKIP xml response for request: ${entry.request.uri}`);
        continue;
      }

      const request: SingleRequestTracking = {
        method: entry.request.method,
        path: url.pathname,
        url: url.href,
        headers: transformRecordingHeaders(entry.request.headers),
        query,
        body: parseRecordingBodyJson(entry.request.body ?? "{}") ?? {},
        responseBody: parseRecordingBodyJson(entry.response.body.string ?? "{}"),
        responseCode: entry.response.status.code,
        responseHeaders,
      };

      result.requests.push(request);
    }

    // for (const entry of result.requests) {
    //   console.log(`${entry.method}\t${entry.path}`);
    // }

    return result;
  }
}
