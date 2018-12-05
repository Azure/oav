import * as errorCodes from "./errorCodes"

export type Report = (code: errorCodes.Code, message: string) => void
