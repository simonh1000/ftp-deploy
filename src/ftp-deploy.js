"use strict";

const path = require("path");
const util = require("util");
const events = require("events");
const Promise = require('bluebird');

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

    this.ftp = new PromiseFtp();

    this.makeAllAndUpload = function(remoteDir, filemap) {
        let keys = Object.keys(filemap);
        return Promise.mapSeries(keys, key => {
            // console.log("Processing", key, filemap[key]);
            return this.makeAndUpload(remoteDir, key, filemap[key]);
        });
    }
    
    // Creates a remote directory and uploads all of the files in it
    this.makeAndUpload = (remoteDir, relDir, fnames) => {
        return this.ftp.mkdir(path.join(remoteDir, relDir), true).then(() => {
            return Promise.mapSeries(fnames, fname => {
                let tmp = path.join(relDir, fname);
                this.emit('uploading', tmp);
                return this.ftp
                    .put(tmp, path.join(remoteDir, relDir, fname))
                    .then(() => {
                        this.emit('uploaded', tmp);
                        return Promise.resolve("uploaded " + tmp);
                    })
                    .catch(err => {
                        this.emit('upload-error', tmp);
                        // if continue on error....
                        return Promise.reject(err)
                    })
            });
        });
    }

    this.configComplete = (config, cb) => {
        return this.ftp
            .connect(config)
            .then(serverMessage => {
                let filemap = lib.parseLocal(config.include, config.exclude, config.localRoot, "/");
                console.log("Connected to:", config.host);
                console.log("Connected: Server message: " + serverMessage);
                // console.log("filemap", filemap);
                return this.makeAllAndUpload(config.remoteRoot, filemap);
            })
            .then(() => {
                this.ftp.end();
                if (typeof cb == "function") {
                    cb(null);
                } else {
                    return Promise.resolve(null);
                }
            })
            .catch(err => {
                console.log(err);
                this.ftp.end()
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
