// export type OpResult<T> = (T extends void ? { isSucc: true } : { isSucc: true, res: T }) | { isSucc: false, errMsg: string }; export type OpResult<T> = (T extends void ? { isSucc: true } : { isSucc: true, res: T }) | { isSucc: false, errMsg: string };
export type OpResult<T> =
  | { isSucc: true; res: T }
  | { isSucc: false; errMsg: string; code?: string; [key: string]: any };
export type OpResultVoid =
  | { isSucc: true }
  | { isSucc: false; errMsg: string; code?: string; [key: string]: any };
