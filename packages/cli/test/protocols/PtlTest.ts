/**
 * 这是一个测试的协议
 * 它的名字叫 Test
 */
export interface ReqTest {
    /** 你的名字 */
    name: string
};

/**
 * 这个应该就是响应了
 */
export type ResTest = {
    reply: string
};