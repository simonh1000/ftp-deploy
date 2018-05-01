"use strict";

const path = require("path");
const util = require("util");
const events = require("events");

var PromiseFtp = require("promise-ftp");
const lib = require("./lib");


/* interim structure 
{
    '/': ['test-inside-root.txt'],
    'folderA': ['test-inside-a.txt'],
    'folderA/folderB': ['test-inside-b.txt'],
    'folderA/folderB/emptyC': [],
    'folderA/folderB/emptyC/folderD': ['test-inside-d-1.txt', 'test-inside-d-2.txt']
}
*/

const FtpDeployer = function() {
    // The constructor for the super class.
    events.EventEmitter.call(this);

    let ftp = new PromiseFtp();

    this.configComplete = function(config, cb) {
        return ftp
            .connect(config)
            .then(function(serverMessage) {
                console.log("Connected to:", config.host);
                console.log("Connected: Server message: " + serverMessage);
                let filemap = lib.parseLocal([],[],config.localRoot, "/");
                console.log("filemap", filemap);
                return lib.makeAllAndUpload(ftp, config.remoteRoot, filemap);
            })
            .then(() => {
                ftp.end();
                if (typeof cb == "function") {
                    cb(null);
                } else {
                    return Promise.resolve(null);
                }
            })
            .catch(err => {
                ftp.end()
                if (typeof cb == "function") {
                    cb(err);
                } else {
                    return Promise.reject(err);
                }
            });
    };

    this.deploy = function(config, cb) {
        if (config.password) {
            return this.configComplete(config);
        } else {
            // Prompt for password if none was given
            lib.getPassword(config).then(res => {
                let config2 = Object.assign(config, { password: res });
                return this.configComplete(config);
            });
        }
    };
};

util.inherits(FtpDeployer, events.EventEmitter);

module.exports = FtpDeployer;
