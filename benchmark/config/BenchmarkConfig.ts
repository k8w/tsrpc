export const benchmarkConfig = {
    /** 压测使用的APIServer */
    server: 'http://127.0.0.1:3000',

    /** 一共运行几次压测事务 */
    total: 200000,
    /** 同时并发的请求数量 */
    concurrency: 100,
    /** API请求的超时时间（超时将断开HTTP连接，释放资源，前端默认为10） */
    timeout: 10000,
    /** 是否将错误的详情日志打印到Log */
    showError: false
}