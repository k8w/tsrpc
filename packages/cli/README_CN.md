TSRPC
===

[EN](README.md) / 中文

[TSRPC](https://npmjs.com/tsrpc) 命令行使用工具

## 安装
```
npm i -g tsrpc-cli
```

## 使用说明
### 开发实用命令
```
tsrpc proto <options>                生成TSRPC Proto文件
    --config <file>                     从指定的配置文件读取参数（忽略其它命令行参数）
    -i, --input <folder>                用来生成Proto的协议文件夹路径
    -o, --output <file>                 输出的文件路径，不指定将直接输出到命令行
                                        -o XXX.ts 和 -o XXX.json 将对应输出两种不同的格式
    -c, --compatible <file>             兼容模式：要兼容的旧Proto文件的路径（默认同output）
    --new                               不兼容旧版，生成全新的Proto文件
    --ugly                              输出为可读性较差但体积更小压缩格式
    --verbose                           显示调试信息
    --ignore <glob>                     从--input范围中要忽略的文件，Glob 表达式
                                        支持传入多个，例如 --ignore "AAA" --ignore "BBB"

tsrpc api <options>                  自动生成TSRPC API实现
    --config <file>                     从指定的配置文件读取参数（忽略其它命令行参数）
    -i, --input <file>                  Proto文件的路径
    -o, --output <folder>               输出的API文件夹路径

tsrpc sync <options>                 同步文件夹内容，以只读方式同步到目标位置
    --config <file>                     从指定的配置文件读取参数（忽略其它命令行参数）
                                        根据配置文件，初始化 Symlink 或只读复制文件
    --from <dir>                        要同步的源文件夹
    --to <dir>                          要同步到的目标位置（只读复制）

tsrpc link <options>                 在目标位置创建到源的 Symlink，以实现自动同步
    --config <file>                     从指定的配置文件读取参数（忽略其它命令行参数）
                                        根据配置文件，初始化 Symlink
    --from <dir>                        要同步的源文件夹
    --to <dir>                          创建 Symlink 的目标位置

tsrpc dev <options>                  启动本地开发服务器，当源代码变更时自动重启
    --config <file>                     从指定的配置文件读取参数（忽略其它命令行参数）

tsrpc build <options>                构建 TSRPC 后端项目
    --config <file>                     从指定的配置文件读取参数（忽略其它命令行参数）
```

## 二进制调试工具

```
tsrpc encode <options> [exp]         编码JS表达式
    [exp]                               要编码的值（JS表达式，例如"123" "new Uint8Array([1,2,3])"）
    -p, --proto <file>                  编码要使用的Proto文件
    -s, --schema <id>                   编码要使用的SchemaID
    -i, --input <file>                  输入为文件，不可与[exp]同用（文件内容为JS表达式）
    -o, --output <file>                 输出的文件路径，不指定将直接输出到命令行
    --verbose                           显示调试信息
                                        
tsrpc decode <options> [binstr]      解码二进制数据
    [binstr]                            要解码的二进制数据的字符串表示，如"0F A2 E3 F2 D9"
    -p, --proto <file>                  解码要使用的Proto文件
    -s, --schema <id>                   解码要使用的SchemaID
    -i, --input <file>                  输入为文件，不可与[binstr]同用
    -o, --output <file>                 输出的文件路径，不指定将直接输出到命令行
    --verbose                           显示调试信息

tsrpc validate <options> [exp]       验证JSON数据
    [exp]                               要验证的值（JS表达式，例如"123" "new Uint8Array([1,2,3])"）
    -p, --proto <file>                  验证要使用的Proto文件
    -s, --schema <id>                   验证要使用的SchemaID
    -i, --input <file>                  输入为文件，不可与[exp]同用（文件内容为JS表达式）

tsrpc show <file>                    打印二进制文件内容
```

## 示例

### 通过配置文件使用
```
tsrpc proto --config tsrpc.config.ts
tsrpc api   --config tsrpc.config.ts
tsrpc sync  --config tsrpc.config.ts
tsrpc link  --config tsrpc.config.ts
tsrpc dev   --config tsrpc.config.ts
tsrpc build --config tsrpc.config.ts
```

### 生成Proto
```
tsrpc proto -i shared/protocols -o shared/protocols/proto.ts
```

### 编码测试
```
tsrpc encode -p proto.json -s a/b/c/TypeName "{value: 1}"
tsrpc encode -p proto.ts -s a/b/c/TypeName "{value: 1}" -o buf.bin 
```

### 解码测试
```
tsrpc decode -p proto.json -s a/b/c/TypeName "01 0A 01"
tsrpc decode -p proto.json -s a/b/c/TypeName -i buf.bin
```

### 类型验证
```
tsrpc validate -p proto.json -s a/b/c/TypeName "{value: 1}"
tsrpc validate -p proto.json -s a/b/c/TypeName -i value.js
```

### 显示二进制文件
```
tsrpc show buf.bin
```