import * as assert from 'assert';
import BinaryTextCoder from '../../src/models/BinaryTextCoder';

describe('BinaryTextCoder', function () {
    describe('json <> buffer', function () {
        let json = { a: 1, b: 2 };
        let buffer = BinaryTextCoder.encode(json);
        let restoredJson = BinaryTextCoder.decode(buffer);

        it('json2buffer', function () {
            assert.ok(buffer instanceof Buffer);
            assert.equal(buffer.byteLength, JSON.stringify(json).length);
        })

        it('restored result is correct', function () {
            assert.deepEqual(restoredJson, json);
        })
    })
})