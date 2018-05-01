'use strict'

const path = require('path');
var assert = require('assert');

const expect = require('chai').expect

const lib = require('./lib');

let exp = {
    '/': ['test-inside-root.txt'],
    'folderA': ['test-inside-a.txt'],
    'folderA/folderB': ['test-inside-b.txt'],
    'folderA/folderB/emptyC': [],
    'folderA/folderB/emptyC/folderD': ['test-inside-d-1.txt', 'test-inside-d-2.txt']
};

describe('dirParseSync', () => {
    it('should throw on a bad start directory', () => {
        const testDir = './throw';
        assert.throws(() => lib.parseLocal([], [], testDir, testDir), Error);
    });
    it('should traverse simple directory', () => {
        const rootDir = path.join(__dirname, '../test/simple');
        assert.deepEqual(lib.parseLocal([], [], rootDir, '/'), { "/": ['test-inside-root.excl', 'test-inside-root.txt'] });
    });
    it('should respect excludes (file)', () => {
        const rootDir = path.join(__dirname, '../test/simple');
        assert.deepEqual(lib.parseLocal([], ['*.excl'], rootDir, '/'), { "/": ['test-inside-root.txt'] });
    });
    it('should respect excludes (directory)', () => {
        const rootDir = path.join(__dirname, '../test/local');
        assert.deepEqual(lib.parseLocal([], ['.DS_Store', 'FolderC'], rootDir, '/'), exp);
    });
    it('should traverse test directory', () => {
        const rootDir = path.join(__dirname, '../test/local');
        let exp2 = Object.assign(exp, {"folderA/folderB/FolderC": [ "test-inside-c.txt" ]});
        assert.deepEqual(lib.parseLocal([], ['.DS_Store'], rootDir, '/'), exp2);
    });
})
