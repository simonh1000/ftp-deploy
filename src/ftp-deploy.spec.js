"use strict";
// Mocha tests. https://mochajs.org/#working-with-promises

const path = require("upath");
const fs = require("fs");
const utils = require("util");

const statP = utils.promisify(fs.stat);

const del = require("delete");
const FtpDeploy = require("./ftp-deploy");

const config = {
    user: "anonymous",
    password: "anon", // Optional, prompted if none given
    host: "127.0.0.1",
    port: 2121,
    localRoot: path.join(__dirname, "../test/local"),
    remoteRoot: "/ftp",
    exclude: [],
    include: ["folderA/**/*", "test-inside-root.txt"],
    debugMode: true,
};

describe("ftp-deploy.spec: deploy tests", () => {
    const remoteDir = path.join(__dirname, "../test/remote/ftp");

    it("should fail if badly configured", () => {
        const d = new FtpDeploy();
        const configError = { ...config, port: 212 };
        return del(remoteDir)
            .then(() => {
                return d.deploy(configError);
            })
            .catch((err) => {
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
                let c2 = { ...config, include: [] };
                return d.deploy(c2);
            })
            .catch((err) => {
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
                return d.deploy(config);
            })
            .then(() => {
                // Will reject if file does not exist
                return statP(path.join(remoteDir, "test-inside-root.txt"));
            });
    });
    it("should put a dot file", () => {
        const d = new FtpDeploy();
        return del(remoteDir)
            .then(() => {
                config.include = [".*"];
                return d.deploy(config);
            })
            .then(() => {
                // Will reject if file does not exist
                return statP(path.join(remoteDir, ".testfile"));
            });
    });
});
