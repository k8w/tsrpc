import chalk from 'chalk';
import { ChalkStyle } from 'tsrpc-base';

const style2ChalkCmd = {
  normal: 'white',
  info: 'green',
  error: 'red',
  debug: 'cyan',
  warn: 'yellow',
  gray: 'gray',
  underline: 'underline',
  bold: 'bold',
} as const;
export function NodeChalk(content: string, styles: ChalkStyle[]) {
  let output: string = content;
  for (let style of styles) {
    output = chalk[style2ChalkCmd[style]](output);
  }
  return output;
}
