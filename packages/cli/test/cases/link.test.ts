import assert from "assert";
import chalk from "chalk";
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import 'k8w-extend-native';
import path from "path";
import process from "process";
import { i18n } from '../../src/i18n/i18n';
import { TestUtil } from "./TestUtil";

describe('link', function () {
    before(function () {
        const ctx = new chalk.Instance({ level: 0 });
    })

    it('with config (absolute path)', function () {
        fs.rmSync(path.resolve(__dirname, '../output/sync'), { recursive: true, force: true });
        fs.mkdirSync(path.resolve(__dirname, '../output/sync'));
        process.chdir(path.resolve(__dirname, '../../'));

        let res = execSync(`node -r ts-node/register src/bin.ts link --config test/configs/absolutePath.ts`);
        assert.strictEqual(res.toString().split('\n').filter(v => v).last(), i18n.allLinkedSucc)
        TestUtil.assertSymlink(path.resolve(__dirname, '../output/proto'), path.resolve(__dirname, '../output/sync/symlink'));
        assert.ok(fs.readlinkSync(path.resolve(__dirname, '../output/sync/symlink')).startsWith('.'))
    })

    it('with config (relative path)', function () {
        fs.rmSync(path.resolve(__dirname, '../output/sync'), { recursive: true, force: true });
        fs.mkdirSync(path.resolve(__dirname, '../output/sync'));
        process.chdir(path.resolve(__dirname, '../'));

        let res = execSync(`node -r ts-node/register ../src/bin.ts link --config configs/relativePath.config.ts`);
        assert.strictEqual(res.toString().split('\n').filter(v => v).last(), i18n.allLinkedSucc);
        TestUtil.assertSymlink(path.resolve(__dirname, '../output/proto'), path.resolve(__dirname, '../output/sync/symlink'));
    })

    it('without config', async function () {
        fs.rmSync(path.resolve(__dirname, '../output/sync'), { recursive: true, force: true });
        fs.mkdirSync(path.resolve(__dirname, '../output/sync'));
        process.chdir(path.resolve(__dirname, '../'));

        let res = spawnSync('node', ['-r', 'ts-node/register', '../src/bin.ts', 'link', '--from', 'output/proto', '--to', 'output/sync/symlink']);
        assert.strictEqual(res.stdout.toString().split('\n').filter(v => v).last(), i18n.linkedSucc);
        TestUtil.assertSymlink(path.resolve(__dirname, '../output/proto'), path.resolve(__dirname, '../output/sync/symlink'));
    })
})