import typescript from 'rollup-plugin-typescript2';
import { uglify } from 'rollup-plugin-uglify';

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
                    declaration: true
                }
            }
        }),
        uglify()

    ],
    external: ['tslib']
}