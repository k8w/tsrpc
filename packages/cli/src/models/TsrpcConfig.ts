export interface TsrpcConfig {
    /** 
     * `tsrpc proto` 命令的创建的 ServiceProto
     * 一条记录对应一份 ServiceProto
     */
    proto?: {
        /**
         * protocols 协议目录
         */
        ptlDir: string,
        /**
         * 生成协议时忽略的文件（Glob表达式）
         */
        ignore?: string | string[],
        /**
         * 输出的 ServiceProto文件名，例如 `src/shared/protocols/serviceProto.ts`
         * 扩展名可为 `.ts` 或 `.json`
         */
        output: `${string}`,
        /**
         * 该 ServiceProto 对应的 API 目录，则可通过 `npx tsrpc api` 自动生成对应的 API 文件。
         * 例如 `src/api`
         */
        apiDir?: string,
        /**
         * API 接口文档生成到哪个目录，为空则不生成
         */
        docDir?: string,
        /**
         * 生成 ServiceProto 时，要兼容的上一版 ServiceProto 的路径。
         * @defaultValue 同 `output`，即原地兼容旧版同名文件。
         * false 代表关闭兼容模式，总是生成全新的 ServiceProto
         */
        compatible?: string | false,

        /**
         * `npm run dev` 期间，当这些目录下内容变化时，自动更新 ServiceProto
         * @defaultValue 同 `dev.watch`
         */
        watch?: string | string[],

        /** conf.dev.autoFillNewPtl 为 true 时自动填充的新 Ptl 的模板 */
        ptlTemplate?: PtlTemplate | {
            /**
             * Path for `base.ts`
             */
            baseFile: string,
            /**
             * @defaultValue BaseRequest
             */
            baseReq?: string,
            /**
             * @defaultValue BaseResponse
             */
            baseRes?: string,
            /**
             * @defaultValue BaseConf
             */
            baseConf?: string
        };
        /** conf.dev.autoFillNewPtl 为 true 时自动填充的新 Msg 的模板 */
        msgTemplate?: MsgTemplate | {
            /**
             * Path for `base.ts`
             */
            baseFile: string,
            /**
             * @defaultValue BaseMessage
             */
            baseMsg?: string,
            /**
             * @defaultValue BaseConf
             */
            baseConf?: string
        };
        /** conf.dev.autoApi 为 true 时自动填充的新 Api 的模板 */
        apiTemplate?: ApiTemplate;

        /** @deprecated use `ptlTemplate` instead */
        newPtlTemplate?: PtlTemplate;
        /** @deprecated use `msgTemplate` instead */
        newMsgTemplate?: MsgTemplate;
        /** @deprecated use `apiTemplate` instead */
        newApiTemplate?: ApiTemplate;

        /**
         * 自定义全局 Module 路径的解析方式
         * @experiment 注意：这是实验性特性，可能会在未来版本中被移除
         * @param importPath 例如 import xx from 'abcd/efg' 则 importPath 为 'abcd/efg'
         * @example
         * ```ts
         * resolveModule: (v, dir) => {
         *     v = v.replace(/^@runtime\//, './common/runtime/);
         *     return v;
         * }
         * ```
         * @returns 返回 module 文件的绝对路径（不含扩展名）
         */
        resolveModule?: (importPath: string) => string

    }[],

    /**
     * `tsrpc sync` 命令的相关配置
     */
    sync?: {
        /** 共享代码目录的源，例如 `src/shared` */
        from: string,
        /** 共享代码目录要同步至的位置，例如 `../frontend/src/shared` */
        to: string,
        /**
         * 共享代码目录的同步方式
         * - symlink: 通过 Symlink 自动同步，推荐使用此方式。
         * - copy：通过 `npx tsrpc sync` 命令手动将源目录复制粘贴到目标位置，并将目标位置设为只读。
         */
        type: 'symlink' | 'copy',
        /**
         * 复制文件前是否先清空目标目录（仅对 `copy` 模式生效）
         * @defaultValue false
         */
        clean?: boolean,
        /**
         * 是否以只读方式复制（仅对 `copy` 模式生效）
         * @defaultValue true
         */
        readonly?: boolean,
    }[],

    /**
     * `tsrpc dev` 命令的相关配置
     */
    dev?: {
        /**
         * 当协议文件发生变动时，是否自动重新生成 ServiceProto
         * @defaultValue true
         */
        autoProto?: boolean,

        /**
         * 当共享目录内文件变动时，是否自动同步到目标位置（仅对 `type: 'copy'` 的项生效）
         * @defaultValue true
         */
        autoSync?: boolean,

        /**
         * 自动重新生成 ServiceProto 后，是否自动生成新的 API 文件
         * @defaultValue true
         */
        autoApi?: boolean,

        /**
         * 当创建新的 Ptl / Msg 文件时，是否自动填充文件内容
         * @defaultValue true
         */
        autoFillNewPtl?: boolean,

        /**
         * 当这些目录下内容变化时，重启本地服务
         * @defaultValue src
         */
        watch?: string | string[],
        /**
         * 重启本地服务时使用的入口点，命令为：
         * node -r ts-node/register src/index.ts
         * @defaultValue src/index.ts
         */
        entry?: string,
        /**
         * 运行命令的额外参数
         * `node -r ts-node/register ${args} src/index.ts`
         */
        nodeArgs?: string[],
        /**
         * Watch 文件变动后，延迟多久触发命令（期间如果有新变动，则顺延延迟时间）
         * @defaultValue 2000
         */
        delay?: number,
    },

    /**
     * `tsrpc build` 命令的相关配置
     */
    build?: {
        /** 
         * 构建前是否重新生成 ServiceProto
         * @defaultValue true
         */
        autoProto?: boolean,
        /** 
         * 构建时重新生成 ServiceProto 后，是否立即同步到目标位置（仅对 `type: 'copy'` 的项生效）
         * @defaultValue true
         */
        autoSync?: boolean,
        /**
         * 自动重新生成 ServiceProto 后，是否自动生成新的 API 文件
         * @defaultValue true
         */
        autoApi?: boolean,
        /**
         * 构建后的发布目录，在构建前会先清理此目录
         * @defaultValue dist
         */
        outDir?: string,
    },

    /**
     * 工作目录
     * @defaultValue Current file path
     */
    cwd?: string,

    /**
     * 生成 ServiceProto 时，是否自动检测协议中的冗余信息并在控制台报警
     */
    checkOptimizableProto?: boolean,

    /**
     * 在控制台显示详细的调试信息
     * @defaultValue false
     */
    verbose?: boolean,
}

export type PtlTemplate = (ptlBaseName: string, ptlPath: string, ptlDir: string) => string;
export type MsgTemplate = (msgBaseName: string, msgPath: string, ptlDir: string) => string;
export type ApiTemplate = (apiBaseName: string, apiFileDir: string, ptlFileDir: string) => string;