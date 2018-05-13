"use strict";

const path = require("path");
const util = require("util");
const events = require("events");
const Promise = require('bluebird');
const fs = require('fs');

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

const FtpDeployer = function () {
    // The constructor for the super class.
    events.EventEmitter.call(this);
    this.ftp = null;
    this.eventObject = {
        totalFilesCount: 0,
        transferredFileCount: 1,
        filename: ''
    };

    this.makeAllAndUpload = function (remoteDir, filemap) {
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
                let tmpFileName = path.join(this.config.localRoot, relDir, fname);
                let tmp = fs.readFileSync(tmpFileName);
                this.eventObject['filename'] = path.join(relDir, fname);

                this.emit('uploading', this.eventObject);

                return this.ftp
                    .put(tmp, path.join(remoteDir, relDir, fname))
                    .then(() => {
                        this.eventObject.transferredFileCount++;
                        this.emit('uploaded', this.eventObject);
                        return Promise.resolve("uploaded " + tmpFileName);
                    })
                    .catch(err => {
                        this.eventObject["error"] = err;
                        this.emit('upload-error', this.eventObject);
                        // if continue on error....
                        return Promise.reject(err)
                    })
            });
        });
    }

    // creates list of all files to upload and starts upload process
    this.configComplete = (config) => {
        this.ftp = new PromiseFtp();

        return this.ftp
            .connect(config)
            .then(serverMessage => {
                let filemap = lib.parseLocal(config.include, config.exclude, config.localRoot, "/");
                console.log("Connected to:", config.host);
                console.log("Connected: Server message: " + serverMessage);
                
                // console.log("filemap", filemap);
                this.eventObject['totalFilesCount'] = lib.countFiles(filemap);

                return this.makeAllAndUpload(config.remoteRoot, filemap);
            })
    };

    this.deploy = function (config, cb) {
        this.config = config;

        return lib.checkIncludes(config)
            .then(lib.getPassword)
            .then(config => this.configComplete(config))
            .then(() => {
                this.ftp.end();
                if (typeof cb == "function") {
                    cb(null);
                } else {
                    return Promise.resolve(null);
                }
            })
            .catch(err => {
                if (this.ftp) this.ftp.end();
                console.log("Failed", typeof cb);
                if (typeof cb == "function") {
                    cb(err);
                } else {
                    return Promise.reject(err);
                }
            });
    };
};

util.inherits(FtpDeployer, events.EventEmitter);

module.exports = FtpDeployer;
