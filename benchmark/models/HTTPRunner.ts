import 'colors';
import { benchmarkConfig } from "../config/BenchmarkConfig";
import { TsrpcError } from "tsrpc-proto";
import * as http from "http";
import * as https from "https";
import { TsrpcClientErrorUtil } from '../../src/client/TsrpcClientErrorUtil';
import { serviceProto } from '../protocols/proto';
import { HttpClient } from '../../src/client/http/HttpClient';

export interface HttpRunnerConfig {
    total: number;
    concurrency: number;
    showError?: boolean;
}

export class HttpRunner {

    private _config: HttpRunnerConfig;

    // 执行单个事务的方法
    private _single: (this: HttpRunner) => Promise<void>;

    // 执行进度信息
    private _progress?: {
        startTime: number,
        lastSuccTime?: number,
        started: number,
        finished: number,
        succ: number,
        fail: number
    };

    constructor(single: HttpRunner['_single'], config: HttpRunnerConfig) {
        this._single = single.bind(this);
        this._config = config;
    }

    start() {
        this._progress = {
            startTime: Date.now(),
            started: 0,
            finished: 0,
            succ: 0,
            fail: 0
        }

        // 启动并发
        for (let i = 0; i < this._config.concurrency; ++i) {
            this._doTrans();
        }

        console.log('Benchmark start!');
        this._startReport();
    }

    private _doTrans() {
        if (this._isStoped || !this._progress) {
            return;
        }

        if (this._progress.started < this._config.total) {
            ++this._progress.started;
            let startTime = Date.now();
            this._single().then(v => {
                ++this._progress!.succ;
                this._progress!.lastSuccTime = Date.now();
            }).catch(e => {
                ++this._progress!.fail;
                if (this._config.showError) {
                    console.error('[Error]', e.message);
                }
            }).then(() => {
                ++this._progress!.finished;
                if (this._progress!.finished === this._config.total) {
                    this._finish();
                }
                else {
                    this._doTrans();
                }
            })
        }
    }

    private _reportInterval?: NodeJS.Timeout;
    private _startReport() {
        this._reportInterval = setInterval(() => {
            this._report();
        }, 1000)
    }

    private _isStoped = false;
    stop() {
        this._isStoped = true;
    }

    private _finish() {
        if (!this._progress) {
            return;
        }

        this._reportInterval && clearInterval(this._reportInterval);

        console.log('\n\n-------------------------------\n  Benchmark finished!  \n-------------------------------');

        let usedTime = Date.now() - this._progress.startTime;
        console.log(`  Transaction Execution Result  `.bgBlue.white);
        console.log(`Started=${this._progress.started}, Finished=${this._progress.finished}, UsedTime=${usedTime}ms`.green);
        console.log(`Succ=${this._progress.succ}, Fail=${this._progress.fail}, TPS=${this._progress.succ / (this._progress.lastSuccTime! - this._progress.startTime) * 1000 | 0}\n`.green)

        // TIME TPS(完成的)
        console.log(`  API Execution Result  `.bgBlue.white);

        // [KEY] RPS(完成的) AVG P95 P99
        for (let key in this._apiStat) {
            let stat = this._apiStat[key];
            stat.resTime = stat.resTime.orderBy(v => v);

            let send = stat.sendReq;
            let succ = stat.resTime.length;
            let netErr = stat.networkError;
            let apiErr = stat.otherError;
            let avg = stat.resTime[stat.resTime.length >> 1] | 0;
            let p95 = stat.resTime[stat.resTime.length * 0.95 | 0] | 0;
            let p99 = stat.resTime[stat.resTime.length * 0.99 | 0] | 0;

            this._logTable([
                [{ text: 'Api' + key + ' '.repeat(this._maxApiNameLength - key.length), color: 'green' }, 'Send', 'Succ', 'QPS', 'NetErr', 'ApiErr', 'AVG  ', 'P95  ', 'P99  '],
                ['', '' + send,
                    { text: '' + succ, color: 'green' },
                    { text: '' + (succ / (stat.lastSuccTime - stat.startTime) * 1000 | 0), color: 'green' },
                    netErr ? { text: '' + netErr, color: 'red' } : '0',
                    apiErr ? { text: '' + apiErr, color: 'red' } : '0',
                    { text: avg ? avg + 'ms' : '-', color: 'yellow' },
                    { text: p95 ? p95 + 'ms' : '-', color: 'yellow' },
                    { text: p99 ? p99 + 'ms' : '-', color: 'yellow' }
                ]
            ])
        }
    }

    private _apiStat: {
        [key: string]: {
            sendReq: number,
            resTime: number[],
            succ: number,
            networkError: number,
            otherError: number,
            startTime: number,
            lastSuccTime: number
        }
    } = {};

    private _maxApiNameLength = 0;
    /**
     * callApi 并且计入统计
     */
    callApi: typeof benchmarkClient.callApi = (apiName, req) => {
        this._maxApiNameLength = Math.max(apiName.length, this._maxApiNameLength);

        if (!this._apiStat[apiName]) {
            this._apiStat[apiName] = {
                sendReq: 0,
                resTime: [],
                succ: 0,
                networkError: 0,
                otherError: 0,
                startTime: Date.now(),
                lastSuccTime: 0
            };
        }

        ++this._apiStat[apiName].sendReq;

        let startTime = Date.now();
        return benchmarkClient.callApi(apiName, req).then(res => {
            this._apiStat[apiName].lastSuccTime = Date.now();
            this._apiStat[apiName].resTime.push(Date.now() - startTime);
            ++this._apiStat[apiName].succ;
            return res;
        }).catch((e: TsrpcError) => {
            if (TsrpcClientErrorUtil.isNetworkError(e)) {
                ++this._apiStat[apiName].networkError;
            }
            else {
                ++this._apiStat[apiName].otherError;
            }

            throw e;
        });
    }

    private _report() {
        console.log(new Date().format('hh:mm:ss').gray, `Started=${this._progress!.started}/${this._config.total}, Finished=${this._progress!.finished}, Succ=${this._progress!.succ.toString().green}, Fail=${this._progress!.fail.toString()[this._progress!.fail > 0 ? 'red' : 'white']}`,
            this._progress!.lastSuccTime ? `TPS=${this._progress!.succ / (this._progress!.lastSuccTime - this._progress!.startTime) * 1000 | 0}` : '')

        for (let key in this._apiStat) {
            let stat = this._apiStat[key];

            let send = stat.sendReq;
            let succ = stat.resTime.length;
            let netErr = stat.networkError;
            let apiErr = stat.otherError;

            this._logTable([
                [{ text: 'Api' + key + ' '.repeat(this._maxApiNameLength - key.length), color: 'green' }, 'Send', 'Succ', 'QPS', 'NetErr', 'ApiErr'],
                ['', '' + send,
                    { text: '' + succ, color: 'green' },
                    { text: '' + (succ / (stat.lastSuccTime - stat.startTime) * 1000 | 0), color: 'green' },
                    netErr ? { text: '' + netErr, color: 'red' } : '0',
                    apiErr ? { text: '' + apiErr, color: 'red' } : '0'
                ]
            ])
        }
    }

    private _logTable(rows: [TableCellItem[], TableCellItem[]]) {
        let cellWidths: number[] = [];
        for (let cell of rows[0]) {
            cellWidths.push(typeof cell === 'string' ? cell.length + 4 : cell.text.length + 4);
        }

        for (let row of rows) {
            let line = '';
            for (let i = 0; i < row.length; ++i) {
                let cell = row[i];
                let cellWidth = cellWidths[i];
                if (typeof cell === 'string') {
                    line += cell + ' '.repeat(cellWidth - cell.length);
                }
                else {
                    line += cell.text[cell.color] + ' '.repeat(cellWidth - cell.text.length);
                }
            }
            console.log(line);
        }
    }
}

export const benchmarkClient = new HttpClient({
    server: benchmarkConfig.server,
    proto: serviceProto,
    logger: {
        debug: function () { },
        log: function () { },
        warn: function () { },
        error: function () { },
    },
    timeout: benchmarkConfig.timeout,
    agent: new (benchmarkConfig.server.startsWith('https') ? https : http).Agent({
        keepAlive: true
    })
})

type TableCellItem = (string | { text: string, color: 'green' | 'red' | 'yellow' });