export const generatedPostmanItem = (name: string): string => {
  return `_${name}`;
};
export const generatedGet = (name: string): string => {
  return `${name}_generated_get`;
};

export const defaultQualityReportFilePath = (newmanReportFilePath: string): string => {
  return newmanReportFilePath.replace(".json", "/report.json");
};

export const defaultCollectionFileName = (
  testScenarioFileName: string,
  runId: string,
  testScenarioName: string
) => {
  return `${testScenarioFileName}/${runId}/${testScenarioName}/collection.json`;
};

export const defaultEnvFileName = (
  testScenarioFileName: string,
  runId: string,
  testScenarioName: string
) => {
  return `${testScenarioFileName}/${runId}/${testScenarioName}/env.json`;
};

export const defaultNewmanReport = (
  testScenarioFileName: string,
  runId: string,
  testScenarioName: string
) => {
  return `${testScenarioFileName}/${runId}/${testScenarioName}.json`;
};

export const defaultNewmanDir = (testScenarioFileName: string, runId: string) => {
  return `${testScenarioFileName}/${runId}`;
};

export const getFileNameFromPath = (filePath: string): string => {
  return filePath.replace(/^.*[\\\/]/, "").replace(".yaml", "");
};

export const blobNameDatePostfix = (name: string) => {
  return `${name}_${new Date().toISOString().slice(0, 10)}`;
};
