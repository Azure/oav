import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';

interface PRData {
  number: number;
  repo: string;
}
const testPath = __dirname.replace("\\", "/");
export const repoPath: string = path.join(testPath, "..", ".autopull");

// Function to clone a specific PR's code from the Git repo
export function clonePR(url: string, prNumber: number): void {
  const prBranch = `pull/${prNumber}/head`;
  const execOptions = { cwd: repoPath };
  const outputFile: string = path.join(execOptions.cwd, "stamp.txt");
  const existingData = getPRData(outputFile);

  if (existingData.number != prNumber || existingData.repo !== url ) {
    console.log(`Previously downloaded spec repo does not match targeted prNumber ${prNumber} or repo ${url}`);

    if (fs.existsSync(repoPath)) {
      fs.removeSync(repoPath);
    }
    fs.mkdirSync(repoPath);

    try {
      if (prNumber !== 0) {
        execSync(`git clone ${url} --no-checkout --filter=tree:0 .`, execOptions);
        execSync(`git fetch origin ${prBranch}:b${prNumber}`, execOptions);
        execSync(`git checkout b${prNumber}`, execOptions);
      }
      else {
        execSync(`git clone ${url} --depth 1 .`, execOptions);
      }
      writePRData(outputFile, { repo: url, number: prNumber })
      console.log(`Sucessfully cloned pr ${prNumber}`);
    } catch (error) {
      console.error(`Error cloning PR: ${(<any>error).message}`);
    }
  }
  else {
    console.log(`Previously downloaded spec repo matches the expected PR Number ${prNumber} and repo ${url}. Skipping re-clone.`);
  }
}

function writePRData(targetFile: string, data: PRData): void {
  const serializedData = JSON.stringify(data);
  fs.writeFileSync(targetFile, serializedData);
}

function getPRData(targetFile: string): PRData {
  if (fs.existsSync(targetFile)){
    const jsonData = fs.readFileSync(targetFile, 'utf-8');
    return <PRData>JSON.parse(jsonData);
  }
  else {
    return { number: -1, repo: '' }
  }
}