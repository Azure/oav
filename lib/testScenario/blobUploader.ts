import { BlobServiceClient } from "@azure/storage-blob";
import { inject, injectable } from "inversify";
import { TYPES } from "../inversifyUtils";
import { setDefaultOpts } from "./../swagger/loader";
export interface TestScenarioBlobUploaderOption {
  blobConnectionString?: string;
  enableBlobUploader?: boolean;
}

type ContainName = "postmancollection" | "newmanreport" | "report";

@injectable()
export class BlobUploader {
  private blobServiceClient?: BlobServiceClient;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(@inject(TYPES.opts) private opts: TestScenarioBlobUploaderOption) {
    setDefaultOpts(this.opts, {
      enableBlobUploader: false,
      blobConnectionString: "",
    });
    if (opts.enableBlobUploader) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(
        this.opts.blobConnectionString!
      );
    }
  }

  public async uploadFile(containName: ContainName, blobName: string, filePath: string) {
    if (!this.opts.enableBlobUploader) {
      return;
    }
    const containerClient = this.blobServiceClient!.getContainerClient(containName);
    await containerClient.createIfNotExists();
    const blobClient = containerClient.getBlockBlobClient(blobName);
    await blobClient.uploadFile(filePath);
  }
}
