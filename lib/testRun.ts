/* eslint-disable no-console */
import { createInterface } from "readline";
import { FileSystemJsonLoader } from "./swagger/fileSystemJsonLoader";

const jsonLoader = new FileSystemJsonLoader("/home/htc/dev/azure-rest-api-specs/specification");
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

const documents: any[] = [];

rl.on("line", function (line) {
  console.log(line);
  const result = jsonLoader.load(line);
  documents.push(result);
});

rl.on("close", function () {
  if (global.gc !== undefined) {
    global.gc();
  }
  console.log(documents.length);
  console.log(documents[0]);
});
