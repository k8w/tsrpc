import dts from 'rollup-plugin-dts';
import typescript from 'rollup-plugin-typescript2';
import packageJSON from './package.json';

const banner = `/*!
 * ${packageJSON.name} v${packageJSON.version}
 * -----------------------------------------
 * Copyright (c) King Wang.
 * MIT License
 * https://github.com/k8w/tsrpc
 */`

export default [
    {
        input: './src/index.ts',
        output: [{
            format: 'cjs',
            file: './dist/index.js',
            banner: banner
        }],
        plugins: [
            typescript({
                tsconfigOverride: {
                    compilerOptions: {
                        target: "es5",
                        lib: ["es6", "dom"]
                    }
                }
            })
        ],
        external: ['tslib']
    },
    {
        input: './src/index.ts',
        output: [{
            format: 'es',
            file: './dist/index.mjs',
            banner: banner
        }],
        plugins: [typescript()],
        external: ['tslib']
    },
    {
        input: "./src/index.ts",
        output: [{ file: './dist/index.d.ts', format: 'es' }],
        plugins: [dts()],
    }
]