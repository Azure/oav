import { CacheItem } from "./exampleCache"
export interface ExampleRule  {
  exampleNamePostfix: string
  ruleName: "Minimum" | "Maximum" | undefined
}

export type RuleValidatorFunc = (context:RuleContext)=> boolean | undefined

type RuleValidator =  {
  onParameter?: RuleValidatorFunc,
  onSchema?:RuleValidatorFunc,
  onResponseCode?: RuleValidatorFunc,
  onResponseHeader?:RuleValidatorFunc,
}

const shouldSkip = (cache: CacheItem | undefined, isRequest?: boolean) => {
  return (isRequest && cache?.options?.isReadonly) || (!isRequest && (cache?.options?.isXmsSecret || cache?.options?.isWriteOnly));
};

type RuleContext =  {
  schema?:any,
  propertyName?:string|undefined,
  schemaCache?:CacheItem
  isRequest?: boolean,
  parentSchema?:any
}

export function getRuleValidator(rule:ExampleRule | undefined):RuleValidator {
  const validators = {
    "Minimum": {
      onParameter: (context:RuleContext)=> {
        return context?.schema.required
      },
      onSchema:(context:RuleContext)=> {
        if (context?.propertyName) {
          return context?.schemaCache?.required?.includes(context?.propertyName)
        }
        else if (context.schemaCache && context?.isRequest !== undefined) {
          return !shouldSkip(context.schemaCache,context?.isRequest)
        }
        return true;
      }
    },
    "Maximum": {
      onSchema:(context:RuleContext)=> {
        if (context.schemaCache && context?.isRequest !== undefined) {
          return !shouldSkip(context.schemaCache,context?.isRequest)
        }
        return true;
      }
    }
  }
  if (rule?.ruleName) {
    return validators[rule.ruleName]
  }
  return {}
}

export type RuleSet = ExampleRule []