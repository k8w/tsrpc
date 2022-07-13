import { babel } from '@rollup/plugin-babel';
import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
export default [
    {
        input: './src/index.ts',
        output: [{
            format: 'es',
            file: './dist/index.js',
            banner: require('./scripts/copyright')
        }],
        plugins: [
            typescript({
                tsconfigOverride: {
                    compilerOptions: {
                        declaration: false,
                        declarationMap: false,
                        module: "esnext"
                    }
                }
            }),
            nodeResolve(),
            commonjs(),
            babel({ babelHelpers: 'bundled' })
        ]
    }
]