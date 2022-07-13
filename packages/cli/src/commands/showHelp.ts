import chalk from "chalk";
import { i18n } from "../i18n/i18n";
import { formatStr, showLogo } from "../models/util";

export function cmdShowHelp() {
    showLogo();
    console.log(chalk.green(formatStr(i18n.welcome, { version: '__TSRPC_CLI_VERSION__' })));
    console.log('\n' + i18n.help);
    console.log('\n' + i18n.example);
}