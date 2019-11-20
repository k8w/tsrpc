import typescript from 'rollup-plugin-typescript2';
import { terser } from "rollup-plugin-terser";

export default {
    input: './index.ts',
    output: {
        format: 'cjs',
        file: './dist/index.js'
    },
    plugins: [
        typescript({
            tsconfigOverride: {
                compilerOptions: {
                    declaration: true,
                    module: 'es2015'
                }
            }
        }),
        terser({
            module: true,
            toplevel: true
        })

    ],
    external: ['tslib']
}