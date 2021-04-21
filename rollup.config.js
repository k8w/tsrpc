import typescript from 'rollup-plugin-typescript2';

export default [
    {
        input: './src/index.ts',
        output: [{
            format: 'cjs',
            file: './dist/index.cjs',
            banner: require('./scripts/copyright')
        }],
        plugins: [
            typescript({
                tsconfigOverride: {
                    compilerOptions: {
                        target: 'es2015',
                        declaration: false,
                        declarationMap: false,
                        module: "esnext"
                    }
                }
            })
        ]
    },
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
                        target: 'es2015',
                        declaration: false,
                        declarationMap: false,
                        module: "esnext"
                    }
                }
            })
        ]
    }
]