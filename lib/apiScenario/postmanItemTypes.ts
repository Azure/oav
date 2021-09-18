export type PostmanItemType = Simple | LRO | Prepare | GeneratedGet | Mock | Poller;

interface Basic {
  operationId: string;
  exampleFilePath?: string;
  itemName: string;
  step: string;
}

type Simple = {
  type: "simple";
  exampleName: string;
} & Basic;

type LRO = {
  type: "LRO";
  poller_item_name: string;
  exampleName: string;
} & Basic;

interface Prepare {
  type: "prepare";
}

interface GeneratedGet {
  type: "generated-get";
  lro_item_name: string;
  step?: string;
}

interface Mock {
  type: "mock";
  lro_item_name: string;
}

interface Poller {
  type: "poller";
  lro_item_name: string;
}

export const typeToDescription = (itemType: PostmanItemType) => {
  return JSON.stringify(itemType);
};
