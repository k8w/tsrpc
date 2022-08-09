
export type OpResult<T> = (T extends void ? { isSucc: true } : { isSucc: true, res: T }) | { isSucc: false, errMsg: string };