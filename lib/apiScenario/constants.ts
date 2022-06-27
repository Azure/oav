import { ArmDeploymentScriptResource, ArmTemplate } from "./apiScenarioTypes";

const armDeploymentScript: ArmDeploymentScriptResource = {
  type: "Microsoft.Resources/deploymentScripts",
  apiVersion: "2020-10-01",
  name: "",
  location: "[resourceGroup().location]",
  kind: "AzurePowerShell",
  identity: {
    type: "UserAssigned",
    userAssignedIdentities: {
      "[parameters('userAssignedIdentity')]": {},
    },
  },
  properties: {
    forceUpdateTag: "[parameters('utcValue')]",
    scriptContent: "",
    environmentVariables: [],
    timeout: "PT1H",
    cleanupPreference: "OnSuccess",
    retentionInterval: "P1D",
  },
};

export const armDeploymentScriptTemplate: ArmTemplate = {
  $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  contentVersion: "1.0.0.0",
  parameters: {
    utcValue: {
      type: "string",
      defaultValue: "[utcNow()]",
    },
    userAssignedIdentity: {
      type: "string",
      defaultValue: "$(userAssignedIdentity)",
    },
  },
  resources: [armDeploymentScript],
};
