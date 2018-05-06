const fs = require("fs");
const path = require("path");
const util = require("util");
const read = require("read");
const readP = util.promisify(read);
const minimatch = require("minimatch");

// P H A S E  0

function getPassword(config) {
    let options = {
        prompt:
            "Password for " +
            config.user +
            "@" +
            config.host +
            " (ENTER for none): ",
        default: "",
        silent: true
    };
    return readP(options);
}

function canIncludePath(includes, excludes, filePath) {
    let go = ((acc, item) => acc || minimatch(filePath, item, { matchBase: true }))
    let canInclude = includes.reduce(go, false);

    // Now check whether the file should in fact be specifically excluded
    if (canInclude) {
        // if any excludes match return false
        let go2 = ((acc, item) => acc && !minimatch(filePath, item, { matchBase: true }))
        canInclude = excludes.reduce(go2, true);
    }
    // console.log("canIncludePath", include, filePath, res);
    return canInclude;
}

// A method for parsing the source location and storing the information into a suitably formated object
function parseLocal(includes, excludes, localRootDir, relDir) {
    // reducer
    let handleItem = function(acc, item) {
        const currItem = path.join(fullDir, item);
        const newRelDir = path.relative(localRootDir, currItem);

        if (fs.lstatSync(currItem).isDirectory()) {
            // currItem is a directory. Recurse and attach to accumulator
            let tmp = parseLocal(includes, excludes, localRootDir, newRelDir);
            // console.log("recurse into", newRelDir, tmp);
            for (let key in tmp) {
                if (tmp[key].length == 0) {
                    delete tmp[key];
                }
            }
            return Object.assign(acc, tmp);
        } else {
            // currItem is a file
            // acc[relDir] is always created at previous iteration
            if (canIncludePath(includes, excludes, newRelDir)) {
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
    parseLocal: parseLocal,
    canIncludePath: canIncludePath
};
