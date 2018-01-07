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
        const testDir = './throw';
        assert.throws(() => lib.parseLocal([],[],testDir,testDir), Error);
    });
    it('should traverse simple directory', () => {
        const rootDir = path.join(__dirname, '../test/simple');
        assert.deepEqual(lib.parseLocal([], [], rootDir, '/'), {"/": []});
    })
    it('should traverse test directory', () => {
        const rootDir = path.join(__dirname, '../test/local');
        assert.deepEqual(lib.parseLocal([], [], rootDir, '/'), exp);
    })
})
