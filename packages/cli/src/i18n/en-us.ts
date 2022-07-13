import chalk from "chalk";

export const i18nEnUs = {
    welcome: 'https://npmjs.com/tsrpc\nWelcome to TSRPC utilities V${version}',
    help: `
Usage：

    --- [Recommended] Use Via Config File ---

    tsrpc-cli proto --config tsrpc.config.ts
    tsrpc-cli api   --config tsrpc.config.ts
    tsrpc-cli sync  --config tsrpc.config.ts
    tsrpc-cli link  --config tsrpc.config.ts
    tsrpc-cli dev   --config tsrpc.config.ts
    tsrpc-cli build --config tsrpc.config.ts
    tsrpc-cli doc --config tsrpc.config.ts

    ---------- Use Via CLI Params  ----------

    tsrpc-cli init                           Init "tsrpc.config.ts" and scripts in package.json

    tsrpc-cli proto <options>                Generate proto file
        -i, --input <file>                      Input TS file (support glob expression)
                                                It would generate all exported types
        -o, --output <file>                     Output file (or print to CLI)
        -c, --compatible <file>                 Compatible mode, compatible to old proto (=output by default)
        --new                                   Generate fresh new proto (no compatible)
        --ugly                                  Output as ugly JSON (no indent and smaller)
        --verbose                               Show debug info
        --ignore <glob>                         Files to be ignored from --input

    tsrpc-cli api <options>                  Generate TSRPC API implementations
        -i, --input <file>                      Proto file path (proto.ts or proto.json)
        -o, --output <folder>                   Output api folder path
    
    tsrpc-cli sync                           Sync directory
        --from <dir>                            Source path
        --to <dir>                              Target path (copy and set as read-only)

    tsrpc-cli link <options>                 Create symlink (cross all operating system)
        --from <dir>                            Source path
        --to <dir>                              Target path for created symlink

    tsrpc-cli dev <options>                  Run local dev server
        --config <file>                         Path of config file
        --entry <file>                          Entry file，default is "src/index.ts"

    tsrpc-cli build <options>                Build the server project
        --config <file>                         Path of config file

    tsrpc-cli doc <options>                  Generate API documents (Swagger/OpenAPI, Markdown, TSAPI)
        -i, --input <folder>                    The path of protocols folder
        -o, --output <folder>                   The path of output documents folder
        --verbose                               Show debug info
        --ignore <glob>                         Files to be ignored from --input

Buffer Utilities:

    tsrpc-cli encode <options> [exp]         Encode a JS expression or a file (content is JS expression)
        [exp]                                   Expression to encode (e.g. "123" "new Uint8Array([1,2,3])")
        -p, --proto <file>                      Proto file to use
        -s, --schema <id>                       SchemaID (filePath/TypeName)
        -i, --input <file>                      Input file path, alternative to [exp]
        -o, --output <file>                     Output file path (or print to CLI)
        --verbose                               Show debug info
                                            
    tsrpc-cli decode <options> [binstr]      Decode buffer
        [binstr]                                Buffer to decode, hex string, like "0F A2 E3"
        -p, --proto <file>                      Proto file
        -s, --schema <id>                       SchemaID (filePath/TypeName)
        -i, --input <file>                      Input file path, alternative to [binstr]
        -o, --output <file>                     Output file path (or print to CLI)
        --verbose                               Show debug info

    tsrpc-cli validate <options> [exp]       Validate if a JS expression is valid to a schema
        [exp]                                   Expression to validate (e.g. "123" "new Uint8Array([1,2,3])")
        -p, --proto <file>                      Proto file to use
        -s, --schema <id>                       SchemaID (filePath/TypeName)
        -i, --input <file>                      Input file path, alternative to [exp]

    tsrpc-cli show <file>                    Show a binary file as hex string
`.trim(),
    example: `
Example：

    tsrpc-cli dev --entry src/xxx.ts         Run local dev server
    tsrpc-cli build                          Build the server project
    tsrpc-cli doc                            Generate API document
`.trim(),
    errCmd: 'Error command, use "tsrpc-cli -h" to see more help info.',
    missingParam: 'Missing parameter ${param}, use "tsrpc-cli -h" to see more help info.',
    shouldBeDir: '${path} should be a directory',
    protoSucc: '✔ ServiceProto generated to: ${output}',
    protoFailed: (output: string) => `⨯ Generate ServiceProto failed, please check if there is any TypeScript compile error : ${output}`,
    fileNotExists: 'File not exists: ${file}',
    fileOpenError: 'Failed to open file: ${file}',
    jsParsedError: 'Failed to parse JS expression from: ${file}',
    invalidProtoExt: '旧 ServiceProto 格式非法，仅支持 .ts 和 .json 文件: ${file}',
    protoParsedError: 'Failed to parse old proto: ${file}',
    expParsedError: 'Invalid JS expression',
    or: 'or',
    and: 'and',
    encodeSucc: '✔ Encoded succ to: ${output}',
    decodeSucc: '✔ Decoded succ to: ${output}',
    apiSucc: '✔ Api${apiName} generated: ${apiPath}',
    allApiSucc: '✔ Success，${newCount} new API generated',
    validateSucc: '✔ Validate succ',
    validateFail: '⨯ Validate fail: ${msg}',
    error: ' ERROR ',
    success: ' SUCCESS ',
    helpGuide: 'Use "tsrpc-cli -h" to see more help info.',
    compatibleError: 'Failed to keep compatible with old proto: \n\t|- ${innerError}',
    canOptimizeByNew: (oldProtoPath: string) => `Redundancy in ServiceProto is detected, delete '${oldProtoPath}' manually to optimize this, but it would cause incompatibility between the latest and older protocol. `,
    dirNotExists: 'Directory not exists: ${dir}',
    codeError: 'Build TypeScript failed, please fix code error',
    ifUpdateProto: 'A protocol change is detected, do you need to regenerate ServiceProto?',
    ifSyncNow: 'Execute "npm run sync" after generated successfully?',
    syncFailed: 'Execute "npm run sync" failed, you can manually finish syncing.',
    deleteConfirm: '${target}\nis existed already，delete it and continue?',
    canceled: 'CANCELED',
    confInvalid: 'Invalid TSRPC config file: ${path}',
    missingConfigItem: (itemName: string) => `Missing '${itemName}' in config file`,
    nothingSyncConf: `'sync' is not configurated in the config file`,
    syncedSucc: '✔ Synced successfully',
    allSyncedSucc: '✔ All Synced successfully',
    copy: 'Copy Files:',
    link: 'Create Symlink:',
    junction: 'Create Junction:',
    linkedSucc: '✔ Linked successfully',
    allLinkedSucc: '✔ All linked successfully',
    elevatingForLink: 'Asking for authorization to create symlink',
    linkFailed: 'Authorization to create Symlink failed. Please select "Yes" in the authorization dialog: ',
    linkRetry: 'Retry',
    linkJunction: 'Create Junction instead (Not recommended)',

    devServerRestarting: '\n------ Recompiling & Restarting ------\n',
    startDevServer: '✔ Start Dev Server:',
    devServerStopped: '⨯ Dev Server Stopped',
    protoNotReady: '⨯ Dev Server cannot start，please fix ServiceProto firstly',

    buildClean: (outDir: string) => `Clean '${outDir}'`,
    buildTsc: `Compile TypeScript`,
    buildCopyFiles: `Copy Files`,
    buildSucc: 'Build Successfully!',

    docOpenApiSucc: (path: string) => `OpenAPI generated successfully: ${chalk.cyan(path)}`,
    docTsapiSucc: (path: string) => `TSAPI generated successfully: ${chalk.cyan(path)}`,
    docMdSucc: (path: string) => `Markdown generated successfully: ${chalk.cyan(path)}`,

    fileAlreadyExists: (path: string) => `${path} already exists`,
    npmNotInited: `package.json not exists，please run ${chalk.cyan('npm init')} first`,
    initSucc: (path: string) => `✔ Init successfully: ${path}`,
}