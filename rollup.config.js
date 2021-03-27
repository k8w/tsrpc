import typescript from 'rollup-plugin-typescript2';
import { terser } from "rollup-plugin-terser";

export default {
    input: './src/index.ts',
    output: {
        format: 'cjs',
        file: './dist/index.js'
    },
    plugins: [
        typescript({
            tsconfigOverride: {
                compilerOptions: {
                    declaration: true,
                    module: 'esnext'
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