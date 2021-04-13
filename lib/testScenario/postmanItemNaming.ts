export const generatedPrefix = (name: string): string => {
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
