"use strict";

const path = require("path");
const fs = require("fs");
const utils = require("util");

// var assert = require("assert");

const statP = utils.promisify(fs.stat);

const del = require("delete");
const FtpDeploy = require("./ftp-deploy");

let exp = {
    "/": ["test-inside-root.txt"],
    folderA: ["test-inside-a.txt"],
    "folderA/folderB": ["test-inside-b.txt"],
    "folderA/folderB/emptyC": [],
    "folderA/folderB/emptyC/folderD": [
        "test-inside-d-1.txt",
        "test-inside-d-2.txt"
    ]
};

const config = {
    user: "anonymous",
    password: "anon", // Optional, prompted if none given
    host: "localhost",
    port: 2121,
    localRoot: path.join(__dirname, "../test/local"),
    remoteRoot: "/ftp",
    exclude: [".*", "*", "*/**"],
    include: ["folderA/**/*", 'test-inside-root.txt'],
    debugMode: true
};

describe("deploy", () => {
    const remoteDir = path.join(__dirname, "../test/remote/ftp");

    it("should fail if badly configured", () => {
        const d = new FtpDeploy();
        const configError = Object.assign({}, config, {port: 212});
        return del(remoteDir)
            .then(() => {
                return d.deploy(configError);
            })
            .catch(err => {
                // Should reject if file does not exist
                if (err.code === 'ECONNREFUSED') {
                    return Promise.resolve("got expected error")
                } else {
                    return Promise.reject(err)
                }
            });
    });
    it("should put a file", () => {
        const d = new FtpDeploy();
        return del(remoteDir)
            .then(() => {
                return d.deploy(config);
            })
            .then(() => {
                // Should reject if file does not exist
                return statP(remoteDir + "/test-inside-root.txt");
            });
    });
});
