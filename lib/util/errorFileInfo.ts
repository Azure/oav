import { NodeError } from "./validationError"
import { forEach } from "@ts-common/iterator"
import { TitleObject } from "../validators/specTransformer"
import { log } from "./logging"

export const errorsAddFileInfo = <T extends NodeError<T>, E extends Iterable<T>>(
  errors: E | undefined,
): E | undefined => {
  forEach(errors, errorAddFileInfo)
  return errors
}

const errorAddFileInfo = <T extends NodeError<T>>(error: T): void => {
  const title = error.title
  if (title !== undefined) {
    try {
      const titleObject: TitleObject | undefined = JSON.parse(title)
      if (titleObject !== undefined) {
        error.position = titleObject.position
        error.url = titleObject.url
        error.title = titleObject.title
      }
    // tslint:disable-next-line:no-empty
    } catch {
      log.error(`ICE: can't parse title: ${title}`)
    }
  }
  errorsAddFileInfo(error.errors)
  errorsAddFileInfo(error.inner)
}
