import { log } from "../util/logging";

function randomString(length: number): string {
  const possible = "abcdefghijklmnopqrstuvwxyz";
  let ret = "";

  for (let i = 0; i < length; i++)
    ret += possible.charAt(Math.floor(Math.random() * possible.length));
  return ret;
}

export default class Mocker {
  public mock(paramSpec: any, paramName: string, arrItem?: any): any {
    switch (paramSpec.type) {
      case "string":
        return this.generateString(paramSpec, paramName);
      case "integer":
        return this.generateInteger(paramSpec);
      case "number":
        return this.generateNumber(paramSpec);
      case "boolean":
        return this.generateBoolean(paramSpec);
      case "array":
        return this.generateArray(paramSpec, paramName, arrItem);
      default:
        log.warn(`unknown type ${paramSpec.type}.`);
    }
  }

  private generateString(paramSpec: any, paramName: string) {
    if (paramSpec.format === "date") {
      return new Date().toISOString().split("T")[0];
    }

    if (paramSpec.format === "date-time") {
      return new Date().toISOString();
    }

    if (paramSpec.format === "duration") {
      return `PT${new Date().getMinutes()}M`;
    }

    if ("enum" in paramSpec) {
      if (paramSpec.enum.lengh > 0) {
        console.error(`${paramName}'s enum can not be empty`);
      }
      return paramSpec.enum[0];
    }
    const minLength = "minLength" in paramSpec ? paramSpec.minLength : 1;
    const maxLength = "maxLength" in paramSpec ? paramSpec.maxLength : minLength * 30;
    // NOTE: hard to handle minLength/maxLength and regular expressions at the same time. Length limit should be set by regex.
    // If the mocked value fails to meet the constraints, error info will be logged and empty string will return.
    if ("pattern" in paramSpec) {
      const Mock = require("mockjs");
      return this.mockForPattern(
        Mock,
        paramSpec.pattern,
        paramSpec.minLength,
        paramSpec.maxLength,
        paramName
      );
    }
    const length = this.getRandomInt(minLength, maxLength);
    let mockedValue = randomString(length);

    if (paramSpec.format === "uri") {
      const prefix = "https://microsoft.com/a";
      mockedValue = prefix + mockedValue.slice(prefix.length);
    }

    return mockedValue;
  }

  // Note: complex regular expression may produce wrong value,
  // e.g. "^(?![0-9]+$)(?!-)[a-zA-Z0-9-]{2,49}[a-zA-Z0-9]$", this is caused by the lib mockjs
  private mockForPattern(
    Mock: any,
    pattern: string,
    minLength: any,
    maxLength: any,
    paramName: string
  ) {
    for (let i = 0; i < 10; i++) {
      const { data } = Mock.mock({
        data: new RegExp(pattern),
      });
      if ((minLength && data.length < minLength) || (maxLength && data.length > maxLength)) {
        console.error(
          `string ${paramName} has both regex pattern an length limit, no example can be generated. Set the length limit by regex and retry`
        );
        continue;
      } else {
        return data;
      }
    }
  }

  private generateInteger(paramSpec: any) {
    const min = "minimum" in paramSpec ? paramSpec.minimum : 1;
    const max = "maximum" in paramSpec ? paramSpec.maximum : min * 30;
    if (max === min) {
      return min;
    }
    const exclusiveMinimum = "exclusiveMinimum" in paramSpec ? paramSpec.exclusiveMinimum : false;
    const exclusiveMaximum = "exclusiveMaximum" in paramSpec ? paramSpec.exclusiveMaximum : false;
    return this.getRandomInt(min, max, !exclusiveMinimum, !exclusiveMaximum);
  }

  private generateNumber(paramSpec: any) {
    const min = "minimum" in paramSpec ? paramSpec.minimum : 1;
    const max = "maximum" in paramSpec ? paramSpec.maximum : min * 30;

    // const exclusiveMinimum = 'exclusiveMinimum' in paramSpec ? paramSpec['exclusiveMinimum'] : false;
    const exclusiveMaximum = "exclusiveMaximum" in paramSpec ? paramSpec.exclusiveMaximum : false;

    if (max === min) {
      return min;
    }
    let randomNumber = Math.floor(Math.random() * (max - min)) + min;
    if (exclusiveMaximum) {
      while (randomNumber === max) {
        randomNumber = Math.floor(Math.random() * (max - min)) + min;
      }
    }
    return randomNumber;
  }

  private getRandomInt(min: number, max: number, minInclusive = true, maxInclusive = true) {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (max === min) {
      return min;
    }
    let randomNumber = Math.floor(Math.random() * (max - min + (maxInclusive ? 1 : 0)));
    if (!minInclusive) {
      while (randomNumber === 0) {
        randomNumber = Math.floor(Math.random() * (max - min + (maxInclusive ? 1 : 0)));
      }
    }
    return randomNumber + min;
  }

  private generateBoolean(_paramSpec: any) {
    return true;
  }

  private generateArray(paramSpec: any, paramName: any, arrItem: any) {
    if (!arrItem) {
      log.warn(`array ${paramName} item is null, it may be caused by circular reference`);
      return [];
    }
    const minItems = "minItems" in paramSpec ? paramSpec.minItems : 1;
    const maxItems = "maxItems" in paramSpec ? paramSpec.maxItems : 1;
    const uniqueItems = "uniqueItems" in paramSpec ? paramSpec.uniqueItems : false;

    if (uniqueItems) {
      if (minItems > 1) {
        console.error(
          `array ${paramName} can not be mocked with both uniqueItems=true and minItems=${minItems}`
        );
        return [];
      }
      return [arrItem];
    }
    const length = this.getRandomInt(minItems, maxItems);
    const list = [];
    for (let i = 0; i < length; i++) {
      list.push(arrItem);
    }
    return list;
  }
}
