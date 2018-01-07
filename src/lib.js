const fs = require('fs');
const path = require('path');

// A utility function to remove lodash/underscore dependency
// Checks an obj for a specified key
function has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}


function canIncludeFile(include, exclude, filePath) {
    let i;

    if (include.length > 0) {
        for (i = 0; i < include.length; i++) {
            if (minimatch(filePath, include[i], { matchBase: true })) {
                return true;
            }
        }
        // Fallthrough to exclude list
    }

    if (exclude.length > 0) {
        for (i = 0; i < exclude.length; i++) {
            if (minimatch(filePath, exclude[i], { matchBase: true })) {
                return false;
            }
        }
    }
    return true;
}

// A method for parsing the source location and storing the information into a suitably formated object
function dirParseSync(startDir, include, exclude) {
    let i;
    let tmpPath;
    let currFile;
    var result = {};

    // Initialize the `result` object if it is the first iteration
    if (result === undefined) {
        result = {};
        result[path.sep] = [];
    }

    // Check if `startDir` is a valid location
    if (!fs.existsSync(startDir)) {
        throw new Error(startDir + ' is not an existing location');
        // console.error(startDir + 'is not an existing location');
    }

    // Iterate throught the contents of the `startDir` location of the current iteration
    const files = fs.readdirSync(startDir);
    for (i = 0; i < files.length; i++) {
        currFile = path.join(startDir, files[i]);

        if (fs.lstatSync(currFile).isDirectory()) {
            tmpPath = path.relative(localRoot, currFile);

            // Check exclude rules
            if (lib.canIncludeFile(include, exclude, tmpPath)) {
                if (!lib.has(result, tmpPath)) {
                    result[tmpPath] = [];
                    // partialDirectories.push(tmpPath);
                }
                dirParseSync(currFile, result);
            }
        } else {
            // is a file
            tmpPath = path.relative(localRoot, startDir);
            if (tmpPath.length === 0) {
                tmpPath = path.sep;
            }

            // Check exclude rules
            const partialFilePath = path.join(tmpPath, files[i]);
            if (lib.canIncludeFile(include, exclude, partialFilePath)) {
                result[tmpPath].push(files[i]);
                // partialFilePaths.push(partialFilePath);
            }
        }
    }

    return result;
}

module.exports = {
    has: has,
    canIncludeFile: canIncludeFile,
    dirParseSync: dirParseSync
}