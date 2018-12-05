import * as errorCodes from "../util/errorCodes"
import * as liveValidationError from '../models/LiveValidationError';

export const create = (
  code: errorCodes.Code,
  message: string
): liveValidationError.LiveValidationError =>
  new liveValidationError.LiveValidationError(code, message)
