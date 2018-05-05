'use strict'

const path = require('path');
var assert = require('assert');

const expect = require('chai').expect

const lib = require('../src/lib');

let exp = {
    '/': ['test-inside-root.txt'],
    'folderA': ['test-inside-a.txt'],
    'folderA/folderB': ['test-inside-b.txt'],
    'folderA/folderB/emptyC': [],
    'folderA/folderB/emptyC/folderD': ['test-inside-d-1.txt', 'test-inside-d-2.txt']
};

describe('canIncludePath', () => {
    it('should exclude a directory', () => {
        assert.ok(!lib.canIncludePath([], [".*"], ".excludeme"));
    });
    it('should exclude a file', () => {
        assert.ok(!lib.canIncludePath([], [".*"], ".excludedFile.txt"));
    });
    it('should exclude a file in a directory', () => {
        assert.ok(!lib.canIncludePath([], [".excludeme/*"], ".excludeme/text.txt"));
    });
    it('should exclude a file in a directory', () => {
        assert.ok(!lib.canIncludePath([], ["*", "*/**"], ".excludeme/text.txt"));
    });
    it('should exclude a dot file', () => {
        assert.ok(!lib.canIncludePath([], [".*"], ".gitignore"));
    });
    it('should exclude a file in dot directory', () => {
        assert.ok(!lib.canIncludePath([], [".*", "*", "*/**"], ".git/xx/ignore"));
    });
    it('should block file in directory', () => {
        assert.ok(!lib.canIncludePath([], ["*", "*/**"], "includeme/text.txt"));
    });
    it('should respect includes', () => {
        assert.ok(lib.canIncludePath(["includeme/*"], [".*", "*", "*/**"], "includeme/text.txt"));
    });
});

describe('dirParseSync', () => {
    it('should throw on a bad start directory', () => {
        const testDir = './throw';
        assert.throws(() => lib.parseLocal([], [], testDir, testDir), Error);
    });
    it('should traverse simple directory', () => {
        const rootDir = path.join(__dirname, 'simple');
        assert.deepEqual(lib.parseLocal([], [], rootDir, '/'), { "/": ['test-inside-root.excl', 'test-inside-root.txt'] });
    });
    it('should respect excludes (file)', () => {
        const rootDir = path.join(__dirname, 'simple');
        assert.deepEqual(lib.parseLocal([], ['*.excl'], rootDir, '/'), { "/": ['test-inside-root.txt'] });
    });
    it('should respect excludes (directory)', () => {
        const rootDir = path.join(__dirname, 'local');
        assert.deepEqual(lib.parseLocal([], ['.DS_Store', 'FolderC', '.*/**', ".*"], rootDir, '/'), exp);
    });
    it('should respect excludes (directory)', () => {
        assert.deepEqual(lib.parseLocal([], [".*", "*", "*/**"], __dirname, '/'), { '/': [] } );
    });
    it('should traverse test directory', () => {
        const rootDir = path.join(__dirname, 'local');
        let exp2 = Object.assign(exp, {"folderA/folderB/FolderC": [ "test-inside-c.txt" ]});
        assert.deepEqual(lib.parseLocal([], ['.DS_Store', '.*/**', ".*"], rootDir, '/'), exp2);
    });
});
