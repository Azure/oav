export interface Error {
  code: any,
  id: any,
  message: any,
  innerErrors: Error[]
}