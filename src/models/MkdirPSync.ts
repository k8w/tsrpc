import * as fs from 'fs';
import * as path from 'path';

export default function MkdirPSync(dir: string, mode: number = 777) {
    try {
        fs.mkdirSync(dir, mode);
    }
    catch (e) {
        if (e.errno === 34) {
            MkdirPSync(path.dirname(dir), mode);
            MkdirPSync(dir, mode);
        }
    }
}