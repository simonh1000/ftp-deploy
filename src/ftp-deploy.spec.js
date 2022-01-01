"use strict";

const path = require("path");
const fs = require("fs");
const utils = require("util");

const assert = require("assert");

const statP = utils.promisify(fs.stat);

const del = require("delete");
const FtpDeploy = require("./ftp-deploy");

function newTestConfig() {
    return {
        user: "anonymous",
        password: "anon", // Optional, prompted if none given
        host: "localhost",
        port: 2121,
        localRoot: path.join(__dirname, "../test/local"),
        remoteRoot: "/ftp",
        exclude: [],
        include: ["folderA/**/*", "test-inside-root.txt"],
        debugMode: true
    };
}

describe("deploy tests", () => {
    const remoteDir = path.join(__dirname, "../test/remote/ftp");

    it("should fail if badly configured", () => {
        const d = new FtpDeploy();
        const configError = Object.assign({}, newTestConfig(), { port: 212 });
        return del(remoteDir)
            .then(() => {
                return d.deploy(configError);
            })
            .catch(err => {
                // Should reject if file does not exist
                if (err.code === "ECONNREFUSED") {
                    return Promise.resolve("got expected error");
                } else {
                    return Promise.reject(err);
                }
            });
    });
    it("should fail with no include", () => {
        const d = new FtpDeploy();
        return del(remoteDir)
            .then(() => {
                let c2 = Object.assign({}, newTestConfig(), { include: [] });
                return d.deploy(c2);
            })
            .catch(err => {
                if (err.code === "NoIncludes") {
                    return Promise.resolve("got expected error");
                } else {
                    return Promise.reject(err);
                }
            });
    });
    it("should put a file", () => {
        const d = new FtpDeploy();
        return del(remoteDir)
            .then(() => {
                return d.deploy(newTestConfig());
            })
            .then(() => {
                // Should reject if file does not exist
                return statP(remoteDir + "/test-inside-root.txt");
            })
            .catch(err => {
                throw err;
            });
    });
    it("should put a dot file", () => {
        const d = new FtpDeploy();
        const config = newTestConfig();
        return del(remoteDir)
            .then(() => {
                config.include = [".*"];
                return d.deploy(config);
            })
            .then(() => {
                // Should reject if file does not exist
                return statP(remoteDir + "/.testfile");
            });
    });
    it("should put modified files again", () => {
        const ftpDeploy = new FtpDeploy();
        const config = newTestConfig();
        config.updateNewerFiles = true;

        const filesUploaded = [];
        ftpDeploy.on("uploading", function (data) {
            filesUploaded.push(data.filename);
        });
        return del(remoteDir)
            .then(() => {
                return ftpDeploy.deploy(config);
            }).then(() => {
                filesUploaded.length = 0;
                return ftpDeploy.deploy(config);
            }).then(() => {
                assert(filesUploaded.length == 0);
                // modify a single file")
                fs.writeFileSync(path.resolve(__dirname, '../test/local/test-inside-root.txt'), "modified test inside root\r\n");
                filesUploaded.length = 0;
                return ftpDeploy.deploy(config);
            }).then(() => {
                assert(filesUploaded.length == 1);
                // revert single file
                fs.writeFileSync(path.resolve(__dirname, '../test/local/test-inside-root.txt'), "test inside root\r\n");
                filesUploaded.length = 0;
                return ftpDeploy.deploy(config);
            }).then(() => {
                assert(filesUploaded.length == 1);
            });
    });
});
