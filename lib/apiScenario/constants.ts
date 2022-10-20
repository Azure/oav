import { ArmDeploymentScriptResource, ArmTemplate } from "./apiScenarioTypes";

export const DEFAULT_ARM_ENDPOINT = "https://management.azure.com";
export const DEFAULT_ARM_API_VERSION = "2020-06-01";
export const DEFAULT_ROLE_ASSIGNMENT_API_VERSION = "2022-04-01";

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
