// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import { SwaggerAnalyzer, swaggerDependency } from "./../../lib/testScenario/swaggerAnalyzer";

describe("swagger analyzer", () => {
  it("analyze dependency", async () => {
    const swaggerFilePath =
      "test/testScenario/fixtures/specification/servicefabricmesh/2018-09-01-preview/servicefabricmesh.json";
    const analyzer = SwaggerAnalyzer.create({
      swaggerFilePaths: [swaggerFilePath],
      noExternalDependencyResourceType: false,
      filerTopLevelResourceType: false,
    });
    await analyzer.initialize();
    const exampleDependencies = await analyzer.analyzeDependency();
    const normalizedResult = swaggerDependency(exampleDependencies);
    console.log(normalizedResult);
    expect(normalizedResult).toStrictEqual({
      "specification/servicefabricmesh/2018-09-01-preview/servicefabricmesh.json": [
        {
          resourceType: "Microsoft.ServiceFabricMesh/networks",
          exampleJsonPointer:
            "/applicationResourceDescription/properties/services/0/properties/networkRefs/0/name",
          swaggerResourceIdJsonPath: "/definitions/NetworkRef/properties/name",
          exampleFilePath:
            "specification/servicefabricmesh/2018-09-01-preview/examples/applications/create_update.json",
        },
      ],
    });
  });

  it("analyze dependency with discriminator schema", async () => {
    const swaggerFilePath =
      "test/testScenario/fixtures/specification/datashare/2020-09-01/DataShare.json";
    const analyzer = SwaggerAnalyzer.create({
      swaggerFilePaths: [swaggerFilePath],
      noExternalDependencyResourceType: false,
      filerTopLevelResourceType: false,
    });
    await analyzer.initialize();
    const exampleDependencies = await analyzer.analyzeDependency();
    const normalizedResult = swaggerDependency(exampleDependencies);
    expect(normalizedResult).toStrictEqual({
      "specification/datashare/2020-09-01/DataShare.json": [
        {
          resourceType: "Microsoft.Kusto/clusters",
          exampleJsonPointer: "/dataSet/properties/kustoClusterResourceId",
          swaggerResourceIdJsonPath:
            "/definitions/KustoClusterDataSetProperties/properties/kustoClusterResourceId",
          exampleFilePath:
            "specification/datashare/2020-09-01/examples/DataSets_KustoCluster_Create.json",
        },
        {
          resourceType: "Microsoft.Kusto/clusters/databases",
          exampleJsonPointer: "/dataSet/properties/kustoDatabaseResourceId",
          swaggerResourceIdJsonPath:
            "/definitions/KustoDatabaseDataSetProperties/properties/kustoDatabaseResourceId",
          exampleFilePath:
            "specification/datashare/2020-09-01/examples/DataSets_KustoDatabase_Create.json",
        },
        {
          resourceType: "Microsoft.Sql/servers",
          exampleJsonPointer: "/dataSet/properties/sqlServerResourceId",
          swaggerResourceIdJsonPath:
            "/definitions/SqlDWTableProperties/properties/sqlServerResourceId",
          exampleFilePath:
            "specification/datashare/2020-09-01/examples/DataSets_SqlDWTable_Create.json",
        },
        {
          resourceType: "Microsoft.Synapse/workspaces/sqlPools/schemas/tables",
          exampleJsonPointer: "/dataSet/properties/synapseWorkspaceSqlPoolTableResourceId",
          swaggerResourceIdJsonPath:
            "/definitions/SynapseWorkspaceSqlPoolTableDataSetProperties/properties/synapseWorkspaceSqlPoolTableResourceId",
          exampleFilePath:
            "specification/datashare/2020-09-01/examples/DataSets_SynapseWorkspaceSqlPoolTable_Create.json",
        },
        {
          resourceType: "Microsoft.Sql/servers",
          exampleJsonPointer: "/dataSetMapping/properties/sqlServerResourceId",
          swaggerResourceIdJsonPath:
            "/definitions/SqlDWTableDataSetMappingProperties/properties/sqlServerResourceId",
          exampleFilePath:
            "specification/datashare/2020-09-01/examples/DataSetMappings_SqlDW_Create.json",
        },
        {
          resourceType: "Microsoft.Synapse/workspaces/sqlPools/schemas/tables",
          exampleJsonPointer: "/dataSetMapping/properties/synapseWorkspaceSqlPoolTableResourceId",
          swaggerResourceIdJsonPath:
            "/definitions/SynapseWorkspaceSqlPoolTableDataSetMappingProperties/properties/synapseWorkspaceSqlPoolTableResourceId",
          exampleFilePath:
            "specification/datashare/2020-09-01/examples/DataSetMappings_SynapseWorkspaceSqlPoolTable_Create.json",
        },
      ],
    });
  });
});
