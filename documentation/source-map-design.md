# Source Map Design

## Problems

1. Parsing JSON(YAML?) with a source map
1. Object transformation with a source map

## Extra

1. Output a source map to a file `.map`.

## Proposed Solution for # 2 problem

A global `SourceMap extends Map<Object, Source>`, where
- `Object` is either a parsed object from a source file or a transformed object.
- `Source` is a pointer to file with a line number and column.

```ts
type Source = SourceObject|SourceArray
interface SourceObject: Pointer {
    simpleProperties: { [name: string]: Pointer }
}
interface SourceArray: Pointer {
    items: { []}
}

interface Pointer {

}
```

```ts
interface SourceMap {
    addPrimitiveType(value, source)
    createObject<Original, New>(original: Original, create: (original): Original) => New) {
        const newObject = create(original)
        this[newObject] = this[original]
        return newObject
    }
    createArray<T, S>(source: S, map: (S[K]) => T[K]) {

    }
    createStringMap<T...>(...) {}
    createPropertySet<T...>(...) {}
}
```

```ts
function transformSchema(sourceMap: SourceMap, source: Schema): Schema2 {
    return sourceMap.createObject(
        source,
        () => {
            ...create new object using `source` and return it
            return { ..... "properties": {.... source.properties[k] } }
        })
}
```

## AutoRest
