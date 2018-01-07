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
        // Fall through to exclude list
    }

    if (exclude.length > 0) {
        for (i = 0; i < exclude.length; i++) {
            if (minimatch(filePath, exclude[i], { matchBase: true })) {
                return false;
            }
        }
    }
    // By default, we will handle the file
    return true;
}

// A method for parsing the source location and storing the information into a suitably formated object
function parseLocal(include, exclude, localRoot, relDir) {

    // reducer
    let handleItem = function(acc, item) {
        const currItem = path.join(fullDir, item);

        if (fs.lstatSync(currItem).isDirectory()) {
            const subDir = path.relative(localRoot, currItem);

            if (canIncludeFile(include, exclude, subDir)) {
                // Match a directory to include. Recurse and attach to accumulator
                let tmp = parseLocal(include, exclude, localRoot, subDir);
                return Object.assign(acc, tmp);
            }
            // Match a directory that must be excluded => halt and return current value
            return acc
        } else {
            // acc[relDir] is always created at previous iteration 
            acc[relDir].push(item);
            return acc;
        }
    }
    
    const fullDir = path.join(localRoot, relDir)
    // Check if `startDir` is a valid location
    if (!fs.existsSync(fullDir)) {
        throw new Error(fullDir + ' is not an existing location');
    }

    // Iterate through the contents of the `fullDir` of the current iteration
    const files = fs.readdirSync(fullDir);
    // Add empty array, which may get overwritten by subsequent iterations
    let acc = {};
    acc[relDir] = [];
    const res = files.reduce(handleItem, acc);
    return res;
}

module.exports = {
    has: has,
    canIncludeFile: canIncludeFile,
    parseLocal: parseLocal
}