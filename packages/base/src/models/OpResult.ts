// export type OpResult<T> = (T extends void ? { isSucc: true } : { isSucc: true, res: T }) | { isSucc: false, errMsg: string }; export type OpResult<T> = (T extends void ? { isSucc: true } : { isSucc: true, res: T }) | { isSucc: false, errMsg: string };
export type OpResult<T> = { isSucc: true, res: T } | { isSucc: false, errMsg: string };