"use strict";

const path = require("path");
var assert = require("assert");

const expect = require("chai").expect;

const lib = require("../src/lib");

describe("canIncludePath", () => {
    it("no patterns excludes a fila", () => {
        assert.ok(!lib.canIncludePath([], [], "excludeme.txt"));
    });
    it("should exclude a dot file", () => {
        assert.ok(!lib.canIncludePath([], [], ".gitignore"));
    });
    it("should exclude a directory", () => {
        assert.ok(!lib.canIncludePath([], [], ".excludeme"));
    });
    it("should exclude a file in a directory", () => {
        assert.ok(!lib.canIncludePath([], [], ".excludeme/text.txt"));
    });
    it("should include a file in a directory", () => {
        assert.ok(
            lib.canIncludePath(["includeme/*"], [], "includeme/text.txt")
        );
    });

    it("should include a file in dot directory", () => {
        assert.ok(lib.canIncludePath([".git/**/*"], [], ".git/xx/ignore"));
    });
    it("should respect a partial wildcard", () => {
        assert.ok(
            lib.canIncludePath(["includeme/*.txt"], [], "includeme/text.txt")
        );
    });
    it("should exclude a dot file by default", () => {
        assert.ok(!lib.canIncludePath(["*"], [], ".gitignore"));
    });
    it("dot file must be explicitly included", () => {
        assert.ok(lib.canIncludePath([".*"], [], ".gitignore"));
    });
    it("should respect an exclude", () => {
        assert.ok(!lib.canIncludePath(["*"], ["*.txt"], "excludeme.txt"));
    });
    it("should handle an undefined exclude", () => {
        assert.ok(lib.canIncludePath(["*"], undefined, "excludeme.txt"));
    });
});

describe("dirParseSync", () => {
    it("should throw on a bad start directory", () => {
        const testDir = "./throw";
        assert.throws(() => lib.parseLocal(["*"], testDir, testDir), Error);
    });
    it("should traverse simple directory", () => {
        const rootDir = path.join(__dirname, "../test/simple");
        assert.deepEqual(lib.parseLocal(["*"], [], rootDir, "/"), {
            "/": ["test-inside-root.txt"],
            inner: ["test-inside-root.excl"]
        });
    });
    it("should respect a negate (!)", () => {
        const rootDir = path.join(__dirname, "../test/simple");
        assert.deepEqual(lib.parseLocal(["!*.excl"], [], rootDir, "/"), {
            "/": ["test-inside-root.txt"]
        });
    });
    it("should respect excludes (directory)", () => {
        const rootDir = path.join(__dirname, "../test/local");
        assert.deepEqual(
            lib.parseLocal(
                [".*", "*", "*/**"],
                [".*", "*", "*/**"],
                rootDir,
                "/"
            ),
            { "/": [] }
        );
    });
    it("should exclude dot files/dirs", () => {
        const rootDir = path.join(__dirname, "../test/test2");
        assert.deepEqual(
            lib.parseLocal(
                ["*", "*/**"],
                ["n_modules/**/*", "n_modules/**/.*"],
                rootDir,
                "/"
            ),
            { "/": [],  src: [ 'index.js' ] }
        );
    });
    it("should traverse test directory", () => {
        const rootDir = path.join(__dirname, "../test/local");
        let exp2 = Object.assign(exp, {
            "folderA/folderB/FolderC": ["test-inside-c.txt"]
        });
        assert.deepEqual(
            lib.parseLocal(["*"], [".excludeme/**/*"], rootDir, "/"),
            exp2
        );
    });
});

let exp = {
    "/": ["test-inside-root.txt"],
    folderA: ["test-inside-a.txt"],
    "folderA/folderB": ["test-inside-b.txt"],
    "folderA/folderB/emptyC/folderD": [
        "test-inside-d-1.txt",
        "test-inside-d-2.txt"
    ]
};
