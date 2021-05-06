export const generatedPostmanItem = (name: string): string => {
  return `[generated]${name}`;
};
export const generatedGet = (name: string): string => {
  return `${name}_generated_get`;
};

export const lroPollingUrl = (name: string): string => {
  return `${name.replace(/[\s+\.]/g, "_")}_polling_url`;
};

export const defaultQualityReportFilePath = (newmanReportFilePath: string): string => {
  return newmanReportFilePath.replace(".json", "/report.json");
};

export const defaultCollectionFileName = (name: string, runId: string) => {
  return `${name}/${runId}/collection.json`;
};

export const defaultEnvFileName = (name: string, runId: string) => {
  return `${name}/${runId}/env.json`;
};

export const defaultNewmanReport = (
  testScenarioFileName: string,
  runId: string,
  testScenarioName: string
) => {
  return `${testScenarioFileName}/${runId}/${testScenarioName}.json`;
};

export const getFileNameFromPath = (filePath: string): string => {
  return filePath.replace(/^.*[\\\/]/, "").replace(".yaml", "");
};

export const blobNameDatePostfix = (name: string) => {
  return `${name}_${new Date().toISOString().slice(0, 10)}`;
};
