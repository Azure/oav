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