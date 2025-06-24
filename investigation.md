# Investigating test breaks

Trying to understand how I'm actually functionally breaking tests with this change. I would have thought this would be g2g. Going to do a quick diff to see if we're breaking scenarios in some way.

## With my fix

```
   Building path regex for:  :0/Tables

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:100:11)

  console.log
    Building path regex for:  :0/Tables\(':1(\d+)'\)

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:100:11)

  console.log
    Building path regex for:  :0/(.*)\(\)

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:100:11)

  console.log
    Building path regex for:  :0/(.*)\(PartitionKey=':2(\d+)',RowKey=':3(\d+)'\)

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:100:11)

  console.log
    Building path regex for:  :0/(.*)

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:100:11)

  console.log
    Building path regex for:  :0

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:100:11)

  console.log
    Building path regex for:  :0
```

## Without my fix

```
    Built regex /^([^\/#\?]+?)\/Tables[\/#\?]?$/i

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:110:11)

  console.log
    With keys ,url

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:111:11)

  console.log
    Built regex /^([^\/#\?]+?)\/Tables\('([^\/#\?]+?)'\)[\/#\?]?$/i

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:110:11)

  console.log
    With keys ,url,table

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:111:11)

  console.log
    Built regex /^([^\/#\?]+?)(?:\/(.*))\(\)[\/#\?]?$/i

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:110:11)

  console.log
    With keys ,url,url

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:111:11)

  console.log
    Built regex /^([^\/#\?]+?)(?:\/(.*))\(PartitionKey\='((?:(?!\(PartitionKey\=')[^\/#\?])+?)',RowKey\='((?:(?!',RowKey\=')[^\/#\?])+?)'\)[\/#\?]?$/i

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:110:11)

  console.log
    With keys ,url,url,partitionKey,rowKey

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:111:11)

  console.log
    Built regex /^([^\/#\?]+?)(?:\/(.*))[\/#\?]?$/i

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:110:11)

  console.log
    With keys ,url,url

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:111:11)

  console.log
    Built regex /^([^\/#\?]+?)[\/#\?]?$/i

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:110:11)

  console.log
    With keys ,url

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:111:11)

  console.log
    Built regex /^([^\/#\?]+?)[\/#\?]?$/i

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:110:11)

  console.log
    With keys ,url

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:111:11)

      at buildPathRegex (lib/transform/pathRegexTransformer.ts:100:11)
```


## Test run results after 8.2.0 update and other fixes

```
Test Suites: 1 failed, 1 total
Tests:       5 failed, 1 skipped, 3 passed, 9 total
Snapshots:   5 failed, 3 passed, 8 total
Time:        18.206 s, estimated 27 s
Ran all test suites matching /test\/exampleGeneratorTests.ts/i.

Test Suites: 1 failed, 1 total
Tests:       10 failed, 79 passed, 89 total
Snapshots:   4 failed, 22 passed, 26 total
Time:        8.707 s, estimated 17 s
Ran all test suites matching /test\/liveValidatorTests.ts/i

Test Suites: 1 failed, 1 total
Tests:       7 failed, 28 passed, 35 total
Snapshots:   4 failed, 5 passed, 9 total
Time:        6.825 s, estimated 14 s
Ran all test suites matching /test\/roundtripValidatorTests.ts/i.

Test Suites: 1 failed, 1 total
Tests:       1 failed, 33 passed, 34 total
Snapshots:   0 total
Time:        6.175 s, estimated 14 s
Ran all test suites matching /test\/semanticValidatorTests.ts/i

Test Suites: 1 failed, 1 total
Tests:       2 failed, 3 passed, 5 total
Snapshots:   3 passed, 3 total
Time:        4.426 s, estimated 11 s
Ran all test suites matching /test\/apiScenario\/apiScenarioGeneratorTest.ts/i

Test Suites: 1 failed, 1 total
Tests:       4 failed, 4 total
Snapshots:   0 total
Time:        3.824 s, estimated 10 s
Ran all test suites matching /test\/trafficValidatorTests.ts/i

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        4.012 s, estimated 61 s
Ran all test suites matching /test\/debug_failing_spec.ts/i.

Test Suites: 1 passed, 1 total
Tests:       3 skipped, 4 passed, 7 total
Snapshots:   4 passed, 4 total
Time:        8.522 s, estimated 15 s
Ran all test suites matching /test\/apiScenario\/apiScenarioLoaderTest.ts/i.

Test Suites: 1 passed, 1 total
Tests:       78 passed, 78 total
Snapshots:   0 total
Time:        6.877 s, estimated 14 s
Ran all test suites matching /test\/modelValidatorTests.ts/i

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   6 passed, 6 total
Time:        4.69 s, estimated 12 s
Ran all test suites matching /test\/apiScenario\/postmanCollectionGeneratorTest.ts/i.

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        3.636 s, estimated 11 s
Ran all test suites matching /test\/readOnlyValidationTests.ts/i.

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        3.781 s, estimated 11 s
Ran all test suites matching /test\/suppressionTests.ts/i

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        3.71 s, estimated 10 s
Ran all test suites matching /test\/sourceMapTests.ts/i

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        3.71 s, estimated 10 s
Ran all test suites matching /test\/sourceMapTests.ts/i.

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        4.012 s, estimated 9 s
Ran all test suites matching /test\/ApiTestRuleBasedGeneratorTest.ts/

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
Snapshots:   0 total
Time:        4.064 s, estimated 9 s
Ran all test suites matching /test\/apiScenario\/dataMaskerTest.ts/i

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        3.833 s, estimated 8 s
Ran all test suites matching /test\/utilsTests.ts/i.

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        3.833 s, estimated 8 s
Ran all test suites matching /test\/utilsTests.ts/i.

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        4.077 s, estimated 8 s
Ran all test suites matching /test\/operationSearcherTest.ts/i.

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        4.509 s, estimated 8 s
Ran all test suites matching /test\/getProviderTests.ts/i.

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   2 passed, 2 total
Time:        3.798 s, estimated 7 s
Ran all test suites matching /test\/apiScenario\/markdownReportTest.ts/i

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   1 passed, 1 total
Time:        3.816 s, estimated 7 s
Ran all test suites matching /test\/apiScenario\/junitReportTest.ts/i

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   4 passed, 4 total
Time:        3.904 s, estimated 7 s
Ran all test suites matching /test\/apiScenario\/diffUtilsTest.ts/i
```

## Test run results after fixing new wildcard restrictions.

going after livevalidator tests first

```
Snapshot failures
npm run test -- test/liveValidatorTests.ts

This seems so reasonable of an error, it seems more correct to me I dunno
      ✕ should report error in response for GET/PUT resource calls when id is not returned (19 ms)

      ✕ should report error in response when response code isn't correct in case of long running operation (14 ms)
      ✕ should report error when LRO header is not returned in response in case of long running operation (16 ms)
      ✕ should not report error when LRO header is not returned in response in case of returning 201 code (13 ms)
```
