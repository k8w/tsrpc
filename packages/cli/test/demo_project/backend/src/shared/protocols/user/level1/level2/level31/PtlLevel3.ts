/** AAA 的MINGZI */
export interface AAA {
    /** aaaasdg */
    a: string,
    b: string,
    c: string
}

/** Level3的实际名字 */
export type Level3 = Pick<AAA, 'a' | 'b'>;

/** 测试的Level3 */
export type ReqLevel3 = Level3;

export interface ResLevel3 {
    data: Level3
}

// export const conf = {}