import { MsgChat } from '../../../MsgChat';

export interface ReqTest {
    name: string
};

export type ResTest = {
    reply: string,
    chat?: MsgChat
};