import Crypto from 'k8w-crypto';
export default class Protocol<Req, Res> {
    req: Req;
    res: Res;
    
    readonly name: string;
    readonly filename: string;
    readonly conf: PtlConf;

    /**
     * 
     * @param filename Protocol file path, always assign `__filename` to it.
     * @param conf Custom protocol config, processed them later by yourself.
     */
    constructor(filename: string, conf: PtlConf = {}) {
        this.filename = filename;

        let nameMatch = filename.match(/Ptl(\w+)\.ts/);
        if (!nameMatch) {
            throw new Error('Invalid protocol filename, must with prefix `Ptl`')
        }
        this.name = nameMatch[1];
        
        this.conf = conf;
    }
}

type PtlConf = { [key: string]: any };