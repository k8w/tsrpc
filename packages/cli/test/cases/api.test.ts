import assert from "assert";
import chalk from "chalk";
import { execSync } from "child_process";
import fs from "fs-extra";
import 'k8w-extend-native';
import path from "path";
import process from "process";

describe('api', function () {
    before(function () {
        const ctx = new chalk.Instance({ level: 0 });
    })

    it('with config (absolute path)', function () {
        fs.rmSync(path.resolve(__dirname, '../output/api'), { recursive: true, force: true });
        process.chdir(path.resolve(__dirname, '../../'));

        let res = execSync(`node -r ts-node/register src/bin.ts api --config test/configs/absolutePath.ts`);
        assert.ok(fs.existsSync(path.resolve(__dirname, '../output/api/ApiTest.ts')));
        assert.ok(fs.existsSync(path.resolve(__dirname, '../output/api/a/b/c/ApiTest.ts')));
    });

    it('with config (relative path)', function () {
        fs.rmSync(path.resolve(__dirname, '../output/api'), { recursive: true, force: true });
        process.chdir(path.resolve(__dirname, '../'));

        let res = execSync(`node -r ts-node/register ../src/bin.ts api --config configs/relativePath.config.ts`);
        assert.ok(fs.existsSync(path.resolve(__dirname, '../output/api/ApiTest.ts')));
        assert.ok(fs.existsSync(path.resolve(__dirname, '../output/api/a/b/c/ApiTest.ts')));
    })

    it('without config', async function () {
        fs.rmSync(path.resolve(__dirname, '../output/api'), { recursive: true, force: true });
        process.chdir(path.resolve(__dirname, '../'));

        let res = execSync('node -r ts-node/register ../src/bin.ts api --input output/proto/serviceProto.ts --output output/api');
        assert.ok(fs.existsSync(path.resolve(__dirname, '../output/api/ApiTest.ts')));
        assert.ok(fs.existsSync(path.resolve(__dirname, '../output/api/a/b/c/ApiTest.ts')));
    })
})