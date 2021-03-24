import { injectable } from "inversify";
import { load as yamlLoad } from "js-yaml";
import { FileLoader } from "../../swagger/fileLoader";
import { Loader } from "../../swagger/loader";
import { AzureCliRecordingLoader } from "./azureCliRecordingLoader";
import { DotnetRecordingLoader } from "./dotnetRecordingLoader";
import { RequestTracking } from "./testScenarioGenerator";

@injectable()
export class TestRecordingLoader implements Loader<RequestTracking> {
  public constructor(
    private fileLoader: FileLoader,
    private dotnetRecordingLoader: DotnetRecordingLoader,
    private azureCliRecordingLoader: AzureCliRecordingLoader
  ) {}

  public async load(filePath: string): Promise<RequestTracking> {
    const fileContent = await this.fileLoader.load(filePath);
    const { content, isJson, isYaml } = this.detectFileType(fileContent, filePath);
    if (isJson) {
      if ("Entries" in content) {
        return this.dotnetRecordingLoader.load([content, filePath]);
      }
    }
    if (isYaml) {
      if ("interactions" in content) {
        return this.azureCliRecordingLoader.load([content, filePath]);
      }
    }

    throw new Error(`Unknown recording type for file: ${filePath}`);
  }

  private detectFileType(fileContent: string, filePath: string) {
    const result = {
      content: undefined as any,
      isJson: false,
      isYaml: false,
    };

    try {
      result.content = JSON.parse(fileContent);
      result.isJson = true;
      return result;
    } catch {
      // Pass
    }

    try {
      result.content = yamlLoad(fileContent);
      result.isYaml = true;
      return result;
    } catch {
      // Pass
    }

    throw new Error(`Unknown file type: ${filePath}`);
  }
}
