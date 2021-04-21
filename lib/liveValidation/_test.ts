import "reflect-metadata";
import { LiveValidator } from "./liveValidator";

const main = async () => {
  const validator = new LiveValidator({
    fileRoot: "/home/htc/azure-rest-api-specs",
    directory: "/home/htc/azure-rest-api-specs",
    swaggerPathsPattern: [
      "specification/resources/resource-manager/Microsoft.Features/stable/2015-12-01/*.json",
    ],
  });

  await validator.initialize();

  const result = await validator.validateLiveRequestResponse({
    liveRequest: {
      headers: {
        "accept-Encoding": "gzip;deflate",
        "accept-Language": "en",
        host: "management.azure.com",
        "x-ms-command-name": "<deleted>",
        "x-ms-client-session-id": "<deleted>",
        "x-ms-client-request-id": "f6a828c4-147f-4cc6-9fc2-bffd7b0be000",
        "x-ms-arm-request-tracking-id": "<deleted>",
        "x-ms-client-location": "<deleted>",
        "x-ms-arm-service-request-id": "<deleted>",
        traceparent: "<deleted>",
        "x-ms-activity-vector": "<deleted>",
      },
      method: "GET",
      url:
        "/subscriptions/95c54dda-ae35-43c0-aeea-bcfc596674c1/providers/Microsoft.Features/providers/Microsoft.AVS/features?api-version=2015-12-01",
    },
    liveResponse: {
      statusCode: "200",
      headers: {
        pragma: "no-cache",
        vary: "Accept-Encoding",
        "x-ms-request-id": "northcentralus:a9282a2f-38fe-4db9-8c3d-af31c3ce4bd5",
        "cache-Control": "no-cache",
        date: "Wed, 05 May 2021 23:47:22 GMT",
      },
      body: {
        value: [
          {
            properties: {
              state: "<deleted>",
            },
            id: "<deleted>",
            type: "<deleted>",
            name: "<deleted>",
          },
          {
            properties: {
              state: "<deleted>",
            },
            id: "<deleted>",
            type: "<deleted>",
            name: "<deleted>",
          },
          {
            properties: {
              state: "<deleted>",
            },
            id: "<deleted>",
            type: "<deleted>",
            name: "<deleted>",
          },
          {
            properties: {
              state: "<deleted>",
            },
            id: "<deleted>",
            type: "<deleted>",
            name: "<deleted>",
          },
          {
            properties: {
              state: "<deleted>",
            },
            id: "<deleted>",
            type: "<deleted>",
            name: "<deleted>",
          },
          {
            properties: {
              state: "<deleted>",
            },
            id: "<deleted>",
            type: "<deleted>",
            name: "<deleted>",
          },
          {
            properties: {
              state: "<deleted>",
            },
            id: "<deleted>",
            type: "<deleted>",
            name: "<deleted>",
          },
          {
            properties: {
              state: "<deleted>",
            },
            id: "<deleted>",
            type: "<deleted>",
            name: "<deleted>",
          },
          {
            properties: {
              state: "<deleted>",
            },
            id: "<deleted>",
            type: "<deleted>",
            name: "<deleted>",
          },
          {
            properties: {
              state: "<deleted>",
            },
            id: "<deleted>",
            type: "<deleted>",
            name: "<deleted>",
          },
        ],
      },
    },
  });

  console.log(result);
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
