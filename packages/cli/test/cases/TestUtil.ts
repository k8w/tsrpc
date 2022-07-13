import assert from "assert";
import fs from "fs";
import glob from "glob";
import path from "path";

export class TestUtil {

    static assertSymlink(src: string, dst: string) {
        let stats
        try {
            stats = fs.lstatSync(dst);
        } catch { }
        if (stats && stats.isSymbolicLink()) {
            const srcStat = fs.statSync(src)
            const dstStat = fs.statSync(dst)
            assert.ok(srcStat.ino);
            assert.ok(srcStat.dev);
            assert.ok(dstStat.ino);
            assert.ok(dstStat.dev);
            assert.strictEqual(srcStat.ino, dstStat.ino);
            assert.strictEqual(srcStat.dev, dstStat.dev);
        }
        else {
            throw new Error(`'${dst}' is not Symlink`);
        }
    }

    static assertDirSame(src: string, dst: string) {
        let dstStats = fs.lstatSync(dst);
        assert.ok(!dstStats.isSymbolicLink(), `'${dst}' should not be Symlink`);

        let srcDir = glob.sync('**/*', { cwd: src });
        let dstDir = glob.sync('**/*', { cwd: dst });
        assert.deepStrictEqual(srcDir, dstDir);
        for (let i = 0; i < srcDir.length; ++i) {
            let srcStat = fs.statSync(path.resolve(src, srcDir[i]));
            if (!srcStat.isFile()) {
                continue;
            }

            assert.deepStrictEqual(
                fs.readFileSync(path.resolve(src, srcDir[i])),
                fs.readFileSync(path.resolve(dst, dstDir[i]))
            )
        }
    }

}