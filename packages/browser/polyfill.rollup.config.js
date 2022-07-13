import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
export default [
    {
        input: './src/index.ts',
        output: [{
            format: 'es',
            file: './dist/index.mjs',
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
            babel({
                babelHelpers: 'bundled',
                presets: [
                    [
                        "@babel/preset-env",
                        {
                            "useBuiltIns": "usage",
                            "corejs": "3.14.0",
                            "debug": true
                        }
                    ]
                ]
            })
        ],
        external: ['tslib', 'k8w-extend-native', /core\-js/]
    }
]