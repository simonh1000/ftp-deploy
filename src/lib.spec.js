'use strict'

const path = require('path');
var assert = require('assert');

const expect = require('chai').expect

const lib = require('./lib');

let exp = { '/': [ 'test-inside-root.txt' ],
'folder a': [ 'test-inside-a.txt' ],
'folder a/folder b': [ 'test-inside-b.txt' ],
'folder a/folder b/empty c': [],
'folder a/folder b/empty c/folder d': [ 'test-inside-d-1.txt', 'test-inside-d-2.txt' ] 
};

describe('dirParseSync', () => {
    it('should throw on a bad start directory', () => {
        const testDir = path.join('./throw');
        assert.throws(() => lib.dirParseSync(testDir), Error);
    });
    // it('should traverse test directory', () => {
    //     const testDir = path.join(__dirname, '../test');
    //     assert.equal(lib.dirParseSync(testDir), exp);
    // })
})
