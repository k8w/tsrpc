import { i18nEnUs } from './en-us';
import { i18nZhCn } from './zh-cn';

// 根据系统语言判断中英文
export const i18n = require('os-locale').sync() === 'zh-CN' ? i18nZhCn : i18nEnUs;

// export const i18n = zhCN;