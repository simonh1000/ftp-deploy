var fs = require('fs');
var path = require('path');
var util = require('util');
var events = require('events');
var Ftp = require('jsftp');
var async = require('async');
var minimatch = require("minimatch");
var read = require('read');

// A utility function to remove lodash/underscore dependency
// Checks an obj for a specified key
function has (obj, key) {
	return Object.prototype.hasOwnProperty.call(obj, key);
}

var FtpDeployer = function () {
	// the constructor for the super class.
	events.EventEmitter.call(this);

	var thisDeployer = this;

	var toTransfer;                // eventually holds the result of dirParseSync()
	var transferredFileCount = 0;
	var ftp;
	var localRoot;
	var remoteRoot;
	var partialDirectories = [];   // holds list of directories to check & create (excluding local root path)
	var partialFilePaths = [];     // holds list of partial file paths to upload
	//var parallelUploads = 1;     // NOTE: this can be added in when sftp is supported
	var exclude = [];
	var continueOnError = false;

	function canIncludeFile(filePath) {
		if (exclude.length > 0) {
			for(var i = 0; i < exclude.length; i++) {
				if (minimatch(filePath, exclude[i], {matchBase: true})) {
					return false;
				}
			}
		}
		return true;
	}

	// A method for parsing the source location and storing the information into a suitably formated object
	function dirParseSync(startDir, result) {
		var files;
		var i;
		var tmpPath;
		var currFile;

		// initialize the `result` object if it is the first iteration
		if (result === undefined) {
			result = {};
			result[path.sep] = [];
		}

		// check if `startDir` is a valid location
		if (!fs.existsSync(startDir)) {
			console.error(startDir + 'is not an existing location');
		}

		// iterate throught the contents of the `startDir` location of the current iteration
		files = fs.readdirSync(startDir);
		for (i = 0; i < files.length; i++) {
			currFile = path.join(startDir, files[i]);

			if (fs.lstatSync(currFile).isDirectory()) {
				tmpPath = path.relative(localRoot, currFile);

				// check exclude rules
				if (canIncludeFile(tmpPath)) {
					if (!has(result, tmpPath)) {
						result[tmpPath] = [];
						partialDirectories.push(tmpPath);
					}
					dirParseSync(currFile, result);
				}
			} else {
				tmpPath = path.relative(localRoot, startDir);
				if (!tmpPath.length) {
					tmpPath = path.sep;
				}

				// check exclude rules
				var partialFilePath = path.join(tmpPath, files[i]);
				if (canIncludeFile(partialFilePath)) {
					result[tmpPath].push(files[i]);
                    partialFilePaths.push(partialFilePath);
				}
			}
		}

		return result;
	}

	// A method for uploading a single file
	function ftpPut(partialFilePath, cb) {
        var remoteFilePath = remoteRoot + "/" + partialFilePath;
        remoteFilePath = remoteFilePath.replace(/\\/g, '/');
        
        var fullLocalPath = path.join(localRoot, partialFilePath);
        
        var emitData = {
            totalFileCount: partialFilePaths.length,
            transferredFileCount: transferredFileCount,
            percentComplete: Math.round((transferredFileCount / partialFilePaths.length) * 100),
            filename: partialFilePath
        };
        
		thisDeployer.emit('uploading', emitData);
		
		ftp.put(fullLocalPath, remoteFilePath, function (err) {
			if (err) {
				emitData.err = err;
				thisDeployer.emit('error', emitData); // error event from 0.5.x TODO: either expand error events or remove this
                thisDeployer.emit('upload-error', emitData);
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
    
    function ftpMakeDirectoriesIfNeeded (cb) {
        async.eachSeries(partialDirectories, ftpMakeRemoteDirectoryIfNeeded, function (err) {
            cb(err);
        });
    }

    // A method for changing the remote working directory and creating one if it doesn't already exist
    function ftpMakeRemoteDirectoryIfNeeded(partialRemoteDirectory, cb) {
        // add the remote root, and clean up the slashes
        var fullRemoteDirectory = remoteRoot + '/' + partialRemoteDirectory.replace(/\\/gi, '/');
        
        // add leading slash if it is missing
        if (fullRemoteDirectory.charAt(0) !== '/') {
            fullRemoteDirectory = '/' + fullRemoteDirectory;
        }
        
        // remove double // if present
        fullRemoteDirectory = fullRemoteDirectory.replace(/\/\//g, "/");
        ftp.raw.cwd(fullRemoteDirectory, function(err) {
            if (err) {
                ftp.raw.mkd(fullRemoteDirectory, function(err) {
                    if(err) {
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

    
	this.deploy = function (config, cb) {
        // Prompt for password if none was given
        if (!config.password) {
            read({prompt: 'Password for ' + config.username + '@' + config.host + ' (ENTER for none): ', default: '', silent:true}, function (err, res) {
            config.password = res;
            configComplete(config, cb);
            });
        } else {
            configComplete(config, cb);
        }
    };

    function configComplete(config, cb) {

        // Init
        ftp = new Ftp({
            host: config.host,
            port: config.port
        });

        localRoot = config.localRoot;
        remoteRoot = config.remoteRoot;
        if (has(config, 'continueOnError')) continueOnError = config.continueOnError;
        exclude = config.exclude || exclude;

        ftp.useList = true;
        toTransfer = dirParseSync(localRoot);
        
        // Authentication and main processing of files
        ftp.auth(config.username, config.password, function (err) {
            if (err) {
                cb(err);
            } else {
                ftpMakeDirectoriesIfNeeded(function (err) {
                    if (err) {
                        // if there was an error creating a remote directory we can't continue to upload files
                        cb(err);
                    } else {
                        async.eachSeries(partialFilePaths, ftpPut, function (err) {
                            if (err) {
                                cb(err);
                            } else {
                                ftp.raw.quit(function (err) {
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