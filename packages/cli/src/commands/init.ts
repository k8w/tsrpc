import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { resPath } from "../bin";
import { i18n } from "../i18n/i18n";

export interface CmdInitOptions {

}

export async function cmdInit(options: CmdInitOptions) {

    if (await fs.pathExists('tsrpc.config.ts')) {
        throw new Error(i18n.fileAlreadyExists('tsrpc.config.ts'));
    }

    if (!await fs.pathExists('package.json')) {
        throw new Error(i18n.npmNotInited);
    }

    await fs.copyFile(path.join(resPath, 'tsrpc.config.ts'), 'tsrpc.config.ts');

    let packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
    Object.merge(packageJson, {
        "scripts": {
            "dev": "tsrpc-cli dev",
            "build": "tsrpc-cli build",
            "doc": "tsrpc-cli doc",
        }
    });
    await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2), 'utf-8');

    console.log(chalk.green(i18n.initSucc(path.resolve('tsrpc.config.ts'))));
}