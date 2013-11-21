var fs = require('fs');
var path = require('path');
var util = require('util');
var events = require('events');
var Ftp = require('jsftp');
var async = require('async');
var minimatch = require("minimatch")

// A utility function to remove lodash/underscore dependency
// Checks an obj for a specified key
function has (obj, key) {
	return Object.prototype.hasOwnProperty.call(obj, key);
}


var FtpDeployer = function () {
	// the constructor for the super class.
	events.EventEmitter.call(this);
	
	var thisDeployer = this;

	this.toTransfer;
	this.transferred = 0;
	this.total = 0;
	var ftp;
	var localRoot;
	var remoteRoot;
	var parallelUploads = 1;
  var exclude = [];
	var currPath;
	var authVals;

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

			if (fs.statSync(currFile).isDirectory()) {
				tmpPath = path.relative(localRoot, currFile);

        // check exclude rules
        if (canIncludeFile(tmpPath)) {
          if (!has(result, tmpPath)) {
            result[tmpPath] = [];
          }
          dirParseSync(currFile, result);
        }
			} else {
				tmpPath = path.relative(localRoot, startDir);
				if (!tmpPath.length) {
					tmpPath = path.sep;
				}

        // check exclude rules
        if (canIncludeFile(path.join(tmpPath, files[i]))) {
          result[tmpPath].push(files[i]);

          // increase total file count
          thisDeployer.total++;
        }
			}
		}
		
		return result;
	}

	// A method for changing the remote working directory and creating one if it doesn't already exist
	function ftpCwd(inPath, cb) {
	   var wrdir = path.basename(inPath);
		ftp.raw.cwd(wrdir, function(err) {
			if (err) {
              	ftp.raw.mkd(wrdir, function(err) {
					if(err) {
						cb(err);
					} else {
						ftpCwd(inPath, cb);
					}
				});
			} else {
				cb();
			}
		});
	}

	// A method for uploading a single file
	function ftpPut(inFilename, cb) {
		thisDeployer.emit('uploading', path.join(currPath, inFilename));
		var fullPathName = path.join(localRoot, currPath, inFilename);
		fs.readFile(fullPathName, function (err, fileData) {
			if (err) {
				cb(err);
			} else {
                console.log('FileName', inFilename);
				ftp.put(inFilename.replace(/\\/gi, '/'), fileData, function(err) {
					if(err) {
						cb(err);
					} else {
						thisDeployer.transferred++;
						thisDeployer.emit('uploaded', path.join(currPath, inFilename));
						cb();
					}
				});
			}	
		});
	}

	// A method that processes a location - changes to a folder and uploads all respective files
	function ftpProcessLocation (inPath, cb) {
		if (!thisDeployer.toTransfer[inPath]) {
			cb(new Error('Data for ' + inPath + ' not found'));
		} else {
			ftpCwd(remoteRoot + '/' + inPath.replace(/\\/gi, '/'), function (err) {
				if (err) {
					cb(err);
				} else {
					var files;
					currPath = inPath;
					files = thisDeployer.toTransfer[inPath];
					async.mapLimit(files, parallelUploads, ftpPut, function (err) {
						if (err) {
							console.error('Failed uploading files!');
						}
						cb(null);
					});
				}
			});
		}
	}

	this.deploy = function (config, cb) {
		
		// Init
		ftp = new Ftp({
			host: config.host,
			port: config.port
		});

		localRoot = config.localRoot; 
		remoteRoot = config.remoteRoot;
		parallelUploads = config.parallelUploads || parallelUploads;
    exclude = config.exclude || exclude;

		ftp.useList = true;
		thisDeployer.toTransfer = dirParseSync(localRoot);

		// Authentication and main processing of files
		ftp.auth(config.username, config.password, function(err) {
			if (err) {
				cb(err);
			} else {
				// Iterating through all location from the `localRoot` in parallel
				var locations = Object.keys(thisDeployer.toTransfer);

				async.mapSeries(locations, ftpProcessLocation, function() {
					ftp.raw.quit(function(err) {
						cb(err);
					});
				});
			}
		});
	};
	
}
util.inherits(FtpDeployer, events.EventEmitter);



// commonJS module systems
if (typeof module !== 'undefined' && "exports" in module) {
	module.exports = FtpDeployer;
}