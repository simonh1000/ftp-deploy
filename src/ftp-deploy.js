"use strict";

const upath = require("upath");
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
        return Promise.map(keys, key => {
            // console.log("Processing", key, filemap[key]);
            return this.makeAndUpload(remoteDir, key, filemap[key]);
        });
    }

    // Creates a remote directory and uploads all of the files in it
    // Resolves a confirmation message on success
    this.makeAndUpload = (config, relDir, fnames) => {
        return this.ftp.mkdir(upath.join(config.remoteRoot, relDir), true).then(() => {
            return Promise.map(fnames, fname => {
                let tmpFileName = upath.join(config.localRoot, relDir, fname);
                let tmp = fs.readFileSync(tmpFileName);
                this.eventObject['filename'] = upath.join(relDir, fname);

                this.emit('uploading', this.eventObject);

                return this.ftp
                    .put(tmp, upath.join(config.remoteRoot, relDir, fname))
                    .then(() => {
                        this.eventObject.transferredFileCount++;
                        this.eventObject.filename = fname;
                        this.emit('uploaded', this.eventObject);
                        return Promise.resolve("uploaded " + this.eventObject.filename);
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

    // connects to the server, Resolves the config on success
    this.connect = (config) => {
        this.ftp = new PromiseFtp();

        return this.ftp
            .connect(config)
            .then(serverMessage => {
                console.log("Connected to:", config.host);
                console.log("Connected: Server message: " + serverMessage);

                return config;
            });
    }


    // creates list of all files to upload and starts upload process
    this.checkLocalAndUpload = (config) => {
        let filemap = lib.parseLocal(config.include, config.exclude, config.localRoot, "/");

        this.eventObject['totalFilesCount'] = lib.countFiles(filemap);

        return this.makeAllAndUpload(config, filemap);
    };

    // Deletes remote directory if requested by config
    // Returns config 
    this.deleteRemote = (config) => {
        if (config.deleteRemote) {
            return lib.deleteDir(this.ftp, config.remoteRoot)
                .then(() => config);
        }
        return Promise.resolve(config)
    };

    this.deploy = function (config, cb) {
        return lib.checkIncludes(config)
            .then(lib.getPassword)
            .then(this.connect)
            .then(this.deleteRemote)
            .then(config => this.checkLocalAndUpload(config))
            .then(() => {
                this.ftp.end();
                if (typeof cb == "function") {
                    cb(null);
                } else {
                    return Promise.resolve(null);
                }
            })
            .catch(err => {
                if (this.ftp && this.ftp.getConnectionStatus() != "disconnected") this.ftp.end();
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
