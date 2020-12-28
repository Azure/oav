import { CacheItem } from "./exampleCache"

interface BaseRule {
  exampleNamePostfix: string
}

export interface ExampleRule extends BaseRule {
  selectedProperties: "Minimum" | "Maximum"
}

const shouldSkip = (cache: CacheItem | undefined, isRequest?: boolean) => {
  return (isRequest && cache?.options?.isReadonly) || (!isRequest && cache?.options?.isXmsSecret);
};

type RuleContext =  {
  cache?:CacheItem,
  childKey?:string|undefined,
  parameter?:any,
  isRequest?: boolean
}

export function getRuleValidator(rule:ExampleRule) {
  const validators = {
    "Minimum": (context:RuleContext)=> {
      if (context?.parameter) {
        return context?.parameter.required
      }
      else if (context?.childKey) {
        return context?.cache?.required?.includes(context?.childKey)
      }
      else if (context.cache && context?.isRequest !== undefined) {
        return !shouldSkip(context.cache,context?.isRequest)
      }
      return true;
    },
    "Maximum": (context:RuleContext)=> {
      if (context.cache && context?.isRequest !== undefined) {
        return !shouldSkip(context.cache,context?.isRequest)
      }
      return true;
    }
  }
  if (rule.selectedProperties) {
    return validators[rule.selectedProperties]
  }
  return ()=>true
}

export function IsValid(rule:ExampleRule | undefined,context:RuleContext) {
  if (!rule) {
    return true
  }
  return getRuleValidator(rule)(context)
}

export type RuleSet = ExampleRule []