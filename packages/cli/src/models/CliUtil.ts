import chalk from "chalk";
import ora from "ora";

export class CliUtil {
    static spinner = ora('');
    static currentDoingText: string | undefined;

    static doing(text: string, doingPostFix: string = '...') {
        if (this.currentDoingText !== undefined) {
            this.spinner.stop();
        }
        this.currentDoingText = text;
        this.spinner.text = chalk.yellow(`${text}${doingPostFix}\n`);
        this.spinner.start();
    }
    static done(succ: boolean = true, text?: string) {
        if (this.currentDoingText !== undefined) {
            text = `${text ?? this.currentDoingText}`
            succ ? this.spinner.succeed(chalk.green(text)) : this.spinner.fail(chalk.red(text));
            this.currentDoingText = undefined;
        }
    }
    static clear() {
        this.spinner.stop();
        this.currentDoingText = undefined;
    }
}