jest.setTimeout(1000000); // Set the timeout in milliseconds

import { buildPathRegex } from "../../lib/transform/pathRegexTransformer";
import { PathParameter } from "../../lib/swagger/swaggerTypes";

const INPUTS: any[] = [
  {
    output_regexp: /^([^\/#\?]+?)\/Tables[\/#\?]?$/i,
    escapedPath: ":0/Tables",
    processedPath: ":0/Tables",
    input_path: "/Tables",
    input_host_template: "{url}",
    input_base_path_prefix: "",
    input_host_params: ["url"],
  },
  {
    output_regexp: /^([^\/#\?]+?)\/Tables\('([^\/#\?]+?)'\)[\/#\?]?$/i,
    escapedPath: ":0/Tables(':1')",
    processedPath: ":0/Tables(':1')",
    input_path: "/Tables('{table}')",
    input_host_template: "{url}",
    input_base_path_prefix: "",
    input_host_params: ["url", "table"],
  },
  {
    output_regexp: /^([^\/#\?]+?)(?:\/(.*))\(\)[\/#\?]?$/i,
    escapedPath: ":0/(.*)()",
    processedPath: ":0/(.*)()",
    input_path: "/{table}()",
    input_host_template: "{url}",
    input_base_path_prefix: "",
    input_host_params: ["url", "table"],
  },
  {
    output_regexp:
      /^([^\/#\?]+?)(?:\/(.*))\(PartitionKey\='([^\/#\?]+?)',RowKey\='([^\/#\?]+?)'\)[\/#\?]?$/i,
    escapedPath: ":0/(.*)(PartitionKey=':2',RowKey=':3')",
    processedPath: ":0/(.*)(PartitionKey=':2',RowKey=':3')",
    input_path: "/{table}(PartitionKey='{partitionKey}',RowKey='{rowKey}')",
    input_host_template: "{url}",
    input_base_path_prefix: "",
    input_host_params: ["url", "table", "partitionKey", "rowKey"],
  },
  {
    output_regexp: /^([^\/#\?]+?)(?:\/(.*))[\/#\?]?$/i,
    escapedPath: ":0/(.*)",
    processedPath: ":0/(.*)",
    input_path: "/{table}",
    input_host_template: "{url}",
    input_base_path_prefix: "",
    input_host_params: ["url", "table"],
  },
  {
    output_regexp: /^([^\/#\?]+?)[\/#\?]?$/i,
    escapedPath: ":0",
    processedPath: ":0",
    input_path: "/",
    input_host_template: "{url}",
    input_base_path_prefix: "",
    input_host_params: ["url"],
  },
  {
    output_regexp: /^([^\/#\?]+?)[\/#\?]?$/i,
    escapedPath: ":0",
    processedPath: ":0",
    input_path: "/",
    input_host_template: "{url}",
    input_base_path_prefix: "",
    input_host_params: ["url"],
  },
];

describe("PathRegexTransformer tests", () => {
  it.each(INPUTS)("transforms %#: %o", (logged) => {
    const {
      output_regexp,
      input_host_template,
      input_base_path_prefix,
      input_path,
      input_host_params,
    } = logged;
    const hostTemplate = input_host_template;
    const basePathPrefix = input_base_path_prefix;
    const path = input_path;
    const hostParams = new Map<string, PathParameter>();
    for (const name of input_host_params) {
      hostParams.set(name, { in: "path", name } as PathParameter);
    }
    const resultRegex = buildPathRegex(hostTemplate, basePathPrefix, path, hostParams);
    expect(resultRegex.toString()).toBe(output_regexp.toString());
  });
});
