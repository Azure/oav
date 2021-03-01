import "reflect-metadata";
import * as fs from "fs";
import { ExampleDiff } from "./exampleDiff";

const main = async () => {
  const newFile = "/home/ruowan/work/oav/generated_examples/ManagedClustersCreate_Update.json";
  const oldFile = "/home/ruowan/work/oav/generated_examples/ManagedClustersCreate_Update_old.json";
  const newExample = JSON.parse(fs.readFileSync(newFile).toString()).responses;
  const oldExample = JSON.parse(fs.readFileSync(oldFile).toString()).responses;

  const diff = new ExampleDiff();
  diff.diff(newExample, oldExample);
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((e) => {
  console.error(e);
});
