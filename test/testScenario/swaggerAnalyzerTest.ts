// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import { SwaggerAnalyzer, normalizeDependency } from "../../lib/testScenario/swaggerAnalyzer";

describe("swagger analyzer", () => {
  it("analyze dependency", async () => {
    const swaggerFilePath =
      "test/apiScenario/fixtures/specification/servicefabricmesh/2018-09-01-preview/servicefabricmesh.json";
    const analyzer = SwaggerAnalyzer.create({
      swaggerFilePaths: [swaggerFilePath],
      noExternalDependencyResourceType: false,
      filerTopLevelResourceType: false,
    });
    await analyzer.initialize();
    const exampleDependencies = await analyzer.analyzeDependency();
    const normalizedResult = normalizeDependency(exampleDependencies);
    expect(normalizedResult).toStrictEqual([
      {
        apiVersion: "2018-09-01-preview",
        exampleName: "CreateOrUpdateApplication",
        fullResourceType: "Microsoft.ServiceFabricMesh/applications",
        resourceProvider: "Microsoft.ServiceFabricMesh",
        fullDependentResourceType: "Microsoft.ServiceFabricMesh/networks",
        operationId: "Application_Create",
        exampleJsonPointer:
          "/applicationResourceDescription/properties/services/0/properties/networkRefs/0/name",
        swaggerResourceIdJsonPointer: "/definitions/NetworkRef/properties/name",
        exampleFilePath:
          "specification/servicefabricmesh/2018-09-01-preview/examples/applications/create_update.json",
        swaggerFilePath:
          "specification/servicefabricmesh/2018-09-01-preview/servicefabricmesh.json",
      },
    ]);
  });

  it("analyze dependency with discriminator schema", async () => {
    const swaggerFilePath =
      "test/apiScenario/fixtures/specification/datashare/2020-09-01/DataShare.json";
    const analyzer = SwaggerAnalyzer.create({
      swaggerFilePaths: [swaggerFilePath],
      noExternalDependencyResourceType: false,
      filerTopLevelResourceType: false,
    });
    await analyzer.initialize();
    const exampleDependencies = await analyzer.analyzeDependency();
    const normalizedResult = normalizeDependency(exampleDependencies);
    expect(normalizedResult).toStrictEqual([
      {
        apiVersion: "2020-09-01",
        exampleName: "DataSets_KustoCluster_Create",
        fullResourceType: "Microsoft.DataShare/accounts/shares/dataSets",
        resourceProvider: "Microsoft.DataShare",
        fullDependentResourceType: "Microsoft.Kusto/clusters",
        operationId: "DataSets_Create",
        exampleJsonPointer: "/dataSet/properties/kustoClusterResourceId",
        swaggerResourceIdJsonPointer:
          "/definitions/KustoClusterDataSetProperties/properties/kustoClusterResourceId",
        exampleFilePath:
          "specification/datashare/2020-09-01/examples/DataSets_KustoCluster_Create.json",
        swaggerFilePath: "specification/datashare/2020-09-01/DataShare.json",
      },
      {
        apiVersion: "2020-09-01",
        exampleName: "DataSets_KustoDatabase_Create",
        fullResourceType: "Microsoft.DataShare/accounts/shares/dataSets",
        resourceProvider: "Microsoft.DataShare",
        fullDependentResourceType: "Microsoft.Kusto/clusters/databases",
        operationId: "DataSets_Create",
        exampleJsonPointer: "/dataSet/properties/kustoDatabaseResourceId",
        swaggerResourceIdJsonPointer:
          "/definitions/KustoDatabaseDataSetProperties/properties/kustoDatabaseResourceId",
        exampleFilePath:
          "specification/datashare/2020-09-01/examples/DataSets_KustoDatabase_Create.json",
        swaggerFilePath: "specification/datashare/2020-09-01/DataShare.json",
      },
      {
        apiVersion: "2020-09-01",
        exampleName: "DataSets_SqlDWTable_Create",
        fullResourceType: "Microsoft.DataShare/accounts/shares/dataSets",
        resourceProvider: "Microsoft.DataShare",
        fullDependentResourceType: "Microsoft.Sql/servers",
        operationId: "DataSets_Create",
        exampleJsonPointer: "/dataSet/properties/sqlServerResourceId",
        swaggerResourceIdJsonPointer:
          "/definitions/SqlDWTableProperties/properties/sqlServerResourceId",
        exampleFilePath:
          "specification/datashare/2020-09-01/examples/DataSets_SqlDWTable_Create.json",
        swaggerFilePath: "specification/datashare/2020-09-01/DataShare.json",
      },
      {
        apiVersion: "2020-09-01",
        exampleName: "DataSets_SynapseWorkspaceSqlPoolTable_Create",
        fullResourceType: "Microsoft.DataShare/accounts/shares/dataSets",
        resourceProvider: "Microsoft.DataShare",
        fullDependentResourceType: "Microsoft.Synapse/workspaces/sqlPools/schemas/tables",
        operationId: "DataSets_Create",
        exampleJsonPointer: "/dataSet/properties/synapseWorkspaceSqlPoolTableResourceId",
        swaggerResourceIdJsonPointer:
          "/definitions/SynapseWorkspaceSqlPoolTableDataSetProperties/properties/synapseWorkspaceSqlPoolTableResourceId",
        exampleFilePath:
          "specification/datashare/2020-09-01/examples/DataSets_SynapseWorkspaceSqlPoolTable_Create.json",
        swaggerFilePath: "specification/datashare/2020-09-01/DataShare.json",
      },
      {
        apiVersion: "2020-09-01",
        exampleName: "DataSetMappings_SqlDW_Create",
        fullResourceType: "Microsoft.DataShare/accounts/shareSubscriptions/dataSetMappings",
        resourceProvider: "Microsoft.DataShare",
        fullDependentResourceType: "Microsoft.Sql/servers",
        operationId: "DataSetMappings_Create",
        exampleJsonPointer: "/dataSetMapping/properties/sqlServerResourceId",
        swaggerResourceIdJsonPointer:
          "/definitions/SqlDWTableDataSetMappingProperties/properties/sqlServerResourceId",
        exampleFilePath:
          "specification/datashare/2020-09-01/examples/DataSetMappings_SqlDW_Create.json",
        swaggerFilePath: "specification/datashare/2020-09-01/DataShare.json",
      },
      {
        apiVersion: "2020-09-01",
        exampleName: "DataSetMappings_SynapseWorkspaceSqlPoolTable_Create",
        fullResourceType: "Microsoft.DataShare/accounts/shareSubscriptions/dataSetMappings",
        resourceProvider: "Microsoft.DataShare",
        fullDependentResourceType: "Microsoft.Synapse/workspaces/sqlPools/schemas/tables",
        operationId: "DataSetMappings_Create",
        exampleJsonPointer: "/dataSetMapping/properties/synapseWorkspaceSqlPoolTableResourceId",
        swaggerResourceIdJsonPointer:
          "/definitions/SynapseWorkspaceSqlPoolTableDataSetMappingProperties/properties/synapseWorkspaceSqlPoolTableResourceId",
        exampleFilePath:
          "specification/datashare/2020-09-01/examples/DataSetMappings_SynapseWorkspaceSqlPoolTable_Create.json",
        swaggerFilePath: "specification/datashare/2020-09-01/DataShare.json",
      },
    ]);
  });
});
