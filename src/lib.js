const fs = require("fs");
const path = require("path");
const util = require("util");
const read = require("read");
const readP = util.promisify(read);
const minimatch = require("minimatch");

// P H A S E 0

function getPassword(config) {
    let options = {
        prompt:
            "Password for " +
            config.username +
            "@" +
            config.host +
            " (ENTER for none): ",
        default: "",
        silent: true
    };
    return readP(options);
}

// A utility function to remove lodash/underscore dependency
// Checks an obj for a specified key
// function has(obj, key) {
//     return Object.prototype.hasOwnProperty.call(obj, key);
// }

function canIncludePath(include, exclude, filePath) {
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
function parseLocal(include, exclude, localRootDir, relDir) {
    // reducer
    let handleItem = function(acc, item) {
        const currItem = path.join(fullDir, item);

        if (fs.lstatSync(currItem).isDirectory()) {
            // currItem is a directory
            const newRelDir = path.relative(localRootDir, currItem);

            if (canIncludePath(include, exclude, newRelDir)) {
                // console.log("recurse into", newRelDir)
                // Match a directory to include. Recurse and attach to accumulator
                let tmp = parseLocal(include, exclude, localRootDir, newRelDir);
                return Object.assign(acc, tmp);
            }
            // Match a directory that must be excluded => halt and return current value
            // console.log("NOT recursing into", newRelDir)
            return acc;
        } else {
            // currItem is a file
            // acc[relDir] is always created at previous iteration
            if (canIncludePath(include, exclude, currItem)) {
                // console.log("including", currItem);
                acc[relDir].push(item);
                return acc;
            }
            {
                // console.log("excluding", currItem);
            }
        }
        return acc;
    };

    const fullDir = path.join(localRootDir, relDir);
    // Check if `startDir` is a valid location
    if (!fs.existsSync(fullDir)) {
        throw new Error(fullDir + " is not an existing location");
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
    getPassword: getPassword,
    parseLocal: parseLocal
};
