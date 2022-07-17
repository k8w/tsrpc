/**
 * For abstract styled log in different platforms.
 * e.g. NodeJS use `chalk`, browser use console.log params.
 */
export type Chalk = (content: string, styles: ChalkStyle[]) => string;

export type ChalkStyle = 'normal' | 'info' | 'error' | 'debug' | 'warn' | 'gray' | 'underline' | 'bold';