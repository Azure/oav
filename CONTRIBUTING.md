# Contributing

There are many ways that you can contribute to the Azure OpenAPI Validation Tools project:

- Submit a bug
- Submit a code fix for a bug
- Submit additions or modifications to the documentation
- Submit a feature request

All code submissions will be reviewed and tested by the team, and those that meet a high bar for both quality and design/roadmap appropriateness will be merged into the project.

## Getting the Code

Make sure you're running Node.js 14+ and NPM 8+, to verify and upgrade NPM do:

```bash
node --version
npm --version
npm i -g npm@latest
```

## Clone this repository

```bash
git clone https://github.com/azure/oav
cd oav
```

## Install dependencies

```bash
npm ci
```

## Build the project

```bash
npm run build
```

## Run the tests

To run all tests in the project

```bash
npm test
```

To run all the tests in a particular test file:

```bash
npm run jest <test-file-name>
```

## Creating a pull request

Always open one pull request per issue and link the issue in the pull request description.
If there is no preexisting issue for your pull request, please create one.

To create a pull request, please:

- Create a branch and add your changes. Make sure you include appropriate tests and documentation.
- Ensure all the tests pass: `npm test`
- Check for lint errors and fix any that are reported: `npm run lint` and `npm run lint-fix`
- Commit your changes using a minimum of individual commits. Squash/fixup commits as needed.
- Push to your fork and submit a pull request to the develop branch. Reference the issue that describes
the problem or feature and include a summary of your changes, noting any significant design decisions.
- Reviewers will be added to your PR automatically and if the PR is approved will merge it.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact
[opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
