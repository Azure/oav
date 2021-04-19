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
  return newmanReportFilePath.replace(".json", "_report.json");
};

export const defaultCollectionFileName = (name: string) => {
  return `${name}_collection.json`;
};

export const defaultEnvFileName = (name: string) => {
  return `${name}_env.json`;
};

export const defaultNewmanReport = (name: string) => {
  return `${name}.json`;
};

export const blobNameDatePostfix = (name: string) => {
  return `${name}_${new Date().toISOString().slice(0, 10)}`;
};
