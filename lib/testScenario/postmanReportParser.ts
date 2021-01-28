export type ReportSchema = {
  name: string;
  executions: Execution[];
};

type Execution = {
  original: ExampleSchema;
  current: ExampleSchema;
};

type ExampleSchema = {
  parameters: KeyValue;
  responses: Response[];
};

type KeyValue = {
  [key: string]: any;
};

type Response = {
  [statusCode: string]: KeyValue;
};
