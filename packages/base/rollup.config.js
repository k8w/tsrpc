import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';
import packageJSON from './package.json';

const banner = `/*!
 * ${packageJSON.name} v${packageJSON.version}
 * -----------------------------------------
 * Copyright (c) King Wang.
 * MIT License
 * ${packageJSON.homepage}
 */`;

export default [
  {
    input: './src/index.ts',
    output: [
      {
        format: 'cjs',
        file: './dist/index.js',
        banner: banner,
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({
        tsconfigOverride: {
          compilerOptions: {
            target: 'es5',
          },
        },
      }),
    ],
    external: ['tslib'],
  },
  {
    input: './src/index.ts',
    output: [
      {
        format: 'es',
        file: './dist/index.mjs',
        banner: banner,
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({
        tsconfigOverride: {
          compilerOptions: {
            target: 'es6',
          },
        },
      }),
    ],
    external: ['tslib'],
  },
  {
    input: './src/index.ts',
    output: [
      {
        file: './dist/index.d.ts',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [
      dts({
        compilerOptions: {
          preserveSymlinks: false,
        },
      }),
    ],
  },
];
