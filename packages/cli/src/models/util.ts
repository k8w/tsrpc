import chalk from "chalk";

export function showLogo() {
    console.log(chalk.green(`                                                   
88888888888 .d8888b.  8888888b.  8888888b.   .d8888b.  
    888    d88P  Y88b 888   Y88b 888   Y88b d88P  Y88b 
    888    Y88b.      888    888 888    888 888    888 
    888     "Y888b.   888   d88P 888   d88P 888        
    888        "Y88b. 8888888P"  8888888P"  888        
    888          "888 888 T88b   888        888    888 
    888    Y88b  d88P 888  T88b  888        Y88b  d88P 
    888     "Y8888P"  888   T88b 888         "Y8888P"  
------------------------------------------------------------------------
`));
};

export function formatStr(str: string, data: { [key: string]: string }) {
    for (let key in data) {
        str = str.replace(`\${${key}}`, data[key]);
    }
    return str;
}

export function error(str: string, data?: { [key: string]: string }): Error {
    if (data) {
        str = formatStr(str, data);
    }
    return new Error(str);
}

export function colorJson(json: any) {
    return (JSON as any).colorStringify(json, null, 2) as string;
};

export function hex2Bin(hexStr: string): Buffer {
    return Buffer.from(new Uint8Array(
        hexStr.trim().split(/\s+/).map(v => parseInt('0x' + v))
    ))
}

export function buf2Hex(buf: Uint8Array): string {
    let arr: string[] = [];
    buf.forEach(v => {
        let char = v.toString(16).toUpperCase();
        if (char.length === 1) {
            char = '0' + char;
        }
        arr.push(char)
    });
    return arr.join(' ');
}