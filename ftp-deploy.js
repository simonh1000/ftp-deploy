"use strict";

const fs = require('fs');
const path = require('path');
const util = require('util');
const events = require('events');
const jsFtp = require('jsftp');
const async = require('async');
const minimatch = require('minimatch');
const read = require('read');

const lib = require('./lib');

const FtpDeployer = function() {
    // The constructor for the super class.
    events.EventEmitter.call(this);

    const thisDeployer = this;

    let transferredFileCount = 0;
    let ftp;
    let localRoot;
    let remoteRoot;
    const partialDirectories = []; // Holds list of directories to check & create (excluding local root path)
    const partialFilePaths = []; // Holds list of partial file paths to upload
    // var parallelUploads = 1;      // NOTE: this can be added in when sftp is supported
    let exclude = [];
    let include = [];
    let continueOnError = false;

    // A method for uploading a single file
    function ftpPut(partialFilePath, cb) {
        let remoteFilePath = remoteRoot + '/' + partialFilePath;
        remoteFilePath = remoteFilePath.replace(/\\/g, '/');

        const fullLocalPath = path.join(localRoot, partialFilePath);

        const emitData = {
            totalFileCount: partialFilePaths.length,
            transferredFileCount,
            percentComplete: Math.round((transferredFileCount / partialFilePaths.length) * 100),
            filename: partialFilePath
        };

        thisDeployer.emit('uploading', emitData);

        ftp.put(fullLocalPath, remoteFilePath, err => {
            if (err) {
                emitData.err = err;
                // thisDeployer.emit('error', emitData); // Error event from 0.5.x TODO: either expand error events or remove this
                // thisDeployer.emit('upload-error', emitData);
                if (continueOnError) {
                    cb();
                } else {
                    cb(err);
                }
            } else {
                transferredFileCount++;
                emitData.transferredFileCount = transferredFileCount;
                thisDeployer.emit('uploaded', emitData);
                cb();
            }
        });
    }

    function ftpMakeDirectoriesIfNeeded(cb) {
        async.eachSeries(partialDirectories, ftpMakeRemoteDirectoryIfNeeded, err => {
            cb(err);
        });
    }

    // A method for changing the remote working directory and creating one if it doesn't already exist
    function ftpMakeRemoteDirectoryIfNeeded(partialRemoteDirectory, cb) {
        // Add the remote root, and clean up the slashes
        let fullRemoteDirectory = remoteRoot + '/' + partialRemoteDirectory.replace(/\\/gi, '/');

        // Add leading slash if it is missing
        if (fullRemoteDirectory.charAt(0) !== '/') {
            fullRemoteDirectory = '/' + fullRemoteDirectory;
        }

        // Remove double // if present
        fullRemoteDirectory = fullRemoteDirectory.replace(/\/\//g, '/');
        ftp.raw('cwd', fullRemoteDirectory, (err) => {
            if (err) {
                ftp.raw('mkd', fullRemoteDirectory, (err) => {
                    if (err) {
                        cb(err);
                    } else {
                        ftpMakeRemoteDirectoryIfNeeded(partialRemoteDirectory, cb);
                    }
                });
            } else {
                cb();
            }
        });
    }

    this.deploy = function(config, cb) {
        // Prompt for password if none was given
        if (config.password) {
            configComplete(config, cb);
        } else {
            read({ prompt: 'Password for ' + config.username + '@' + config.host + ' (ENTER for none): ', default: '', silent: true }, (err, res) => {
                if (err) {
                    return cb(err);
                }
                config.password = res;
                configComplete(config, cb);
            });
        }
    };

    function configComplete(config, cb) {
        // Init
        ftp = new jsFtp({
            host: config.host,
            port: config.port,
            debugMode: config.debugMode
        });

        localRoot = config.localRoot;
        remoteRoot = config.remoteRoot;
        if (lib.has(config, 'continueOnError')) {
            continueOnError = config.continueOnError;
        }
        exclude = config.exclude || exclude;
        include = config.include || include;

        // Unclear what this does 
        // ftp.useList = true;

        // Get a representation of local files - not used!
        // let result = dirParseSync(localRoot);
        // console.log(result);

        // Authentication and main processing of files
        ftp.auth(config.username, config.password, err1 => {
            if (err1) {
                // On auth error, we still need to close the ftp connection
                ftp.raw('quit', (err2, data) => {
                    cb("Auth:", err1, err2);
                });
            } else {
                console.log("Authenticated", Object.keys(ftp));
                ftpMakeDirectoriesIfNeeded(err => {
                    if (err) {
                        // If there was an error creating a remote directory we can't continue to upload files
                        cb(err);
                    } else {
                        async.eachSeries(partialFilePaths, ftpPut, err => {
                            if (err) {
                                cb(err);
                            } else {
                                ftp.raw('quit', (err, data) => {
                                    cb(err);
                                });
                            }
                        });
                    }
                });
            }
        });
    }
};

util.inherits(FtpDeployer, events.EventEmitter);

module.exports = FtpDeployer;