import { dirname } from "path";
import { pathJoin } from "@azure-tools/openapi-tools-common";
import * as YAML from "js-yaml";
import * as openApiMd from "@azure/openapi-markdown";
import * as md from "@ts-common/commonmark-to-markdown";
import * as commonmark from "commonmark";
import { FileLoader } from "../swagger/fileLoader";
import { inversifyGetInstance } from "../inversifyUtils";
import { checkAndResolveGithubUrl } from "./utils";

const safeLoad = (content: string) => {
  try {
    return YAML.load(content) as any;
  } catch (err) {
    return undefined;
  }
};

/**
 * @return return undefined indicates not found, otherwise return non-empty string.
 */
const getDefaultTag = (markDown: commonmark.Node): string | undefined => {
  const startNode = markDown;
  const codeBlockMap = openApiMd.getCodeBlocksAndHeadings(startNode);
  const latestHeader = "Basic Information";
  const headerBlock = codeBlockMap[latestHeader];
  if (headerBlock && headerBlock.literal) {
    const latestDefinition = safeLoad(headerBlock.literal);
    if (latestDefinition && latestDefinition.tag) {
      return latestDefinition.tag;
    }
  }
  for (const idx of Object.keys(codeBlockMap)) {
    const block = codeBlockMap[idx];
    if (
      !block ||
      !block.info ||
      !block.literal ||
      !/^(yaml|json)$/.test(block.info.trim().toLowerCase())
    ) {
      continue;
    }
    const latestDefinition = safeLoad(block.literal);
    if (latestDefinition && latestDefinition.tag) {
      return latestDefinition.tag;
    }
  }
  return undefined;
};

export async function getSwaggerListFromReadme(filepath: string, tag?: string): Promise<string[]> {
  const fileLoader = inversifyGetInstance(FileLoader, {});
  const m = md.parse(await fileLoader.load(checkAndResolveGithubUrl(filepath)));
  if (!tag || tag === "default") {
    tag = getDefaultTag(m.markDown);
  }
  if (tag) {
    const fileRoot = dirname(filepath);
    const rawInputFiles = openApiMd.getInputFilesForTag(m.markDown, tag);
    if (rawInputFiles) {
      return rawInputFiles.map((f) => pathJoin(fileRoot, f));
    }
  }
  return [];
}
