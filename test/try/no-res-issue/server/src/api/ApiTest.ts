import { ReqTest, ResTest } from "../../protocols/PtlTest";
import { ApiCall } from "../../../../..";

export async function ApiTest(call: ApiCall<ReqTest, ResTest>) {
    await new Promise(rs => {
        let i = 5;
        call.logger.log(i);
        let interval = setInterval(() => {
            call.logger.log(--i);
            if (i === 0) {
                clearInterval(interval);
                rs();
            }
        }, 1000);
    });

    call.error('asdfasdf', { a: 1, b: 2 })
}