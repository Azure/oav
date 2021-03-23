export const generatedPrefix = (name: string): string => {
  return `[generated]${name}`;
};
export const generatedGet = (name: string): string => {
  return `${name}_generated_get`;
};

export const lroPollingUrl = (name: string): string => {
  return `${name}_polling_url`;
};
