import { Severity } from "./severity"
import { ValidationResultSource } from "./validationResultSource"

export interface BaseValidationError {
  severity?: Severity;
  errorCode?: string;
  errorDetails?: string;
  source?: ValidationResultSource;
  count?: number;
}
