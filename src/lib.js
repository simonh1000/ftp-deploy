const fs = require("fs");
const path = require("path");
const util = require("util");

const read = require("read");
const readP = util.promisify(read);

const { minimatch } = require("minimatch");

// P H A S E  0

function checkIncludes(config) {
    config.exclude = config.exclude || [];
    if (!config.include || !config.include.length) {
        return Promise.reject({
            code: "NoIncludes",
            message: "You need to specify files to upload - e.g. ['*', '**/*']",
        });
    } else {
        return Promise.resolve(config);
    }
}

function getPassword(config) {
    if (config.password) {
        return Promise.resolve(config);
    } else {
        let options = {
            prompt:
                "Password for " +
                config.user +
                "@" +
                config.host +
                " (ENTER for none): ",
            default: "",
            silent: true,
        };
        return readP(options).then((res) => {
            let config2 = Object.assign(config, { password: res });
            return config2;
        });
    }
}

// Analysing local firstory

function canIncludePath(includes, excludes, filePath) {
    let go = (acc, item) =>
        acc || minimatch(filePath, item, { matchBase: true });
    let canInclude = includes.reduce(go, false);

    // Now check whether the file should in fact be specifically excluded
    if (canInclude) {
        // if any excludes match return false
        if (excludes) {
            let go2 = (acc, item) =>
                acc && !minimatch(filePath, item, { matchBase: true });
            canInclude = excludes.reduce(go2, true);
        }
    }
    // console.log("canIncludePath", include, filePath, res);
    return canInclude;
}

// A method for parsing the source location and storing the information into a suitably formated object
function parseLocal(includes, excludes, localRootDir, relDir) {
    // reducer
    let handleItem = function (acc, item) {
        const currItem = path.join(fullDir, item);
        const newRelDir = path.relative(localRootDir, currItem);

        if (fs.lstatSync(currItem).isDirectory()) {
            // currItem is a directory. Recurse and attach to accumulator
            let tmp = parseLocal(includes, excludes, localRootDir, newRelDir);
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

function countFiles(filemap) {
    return Object.values(filemap).reduce((acc, item) => acc.concat(item))
        .length;
}

function deleteDir(ftp, dir, preserve = []) {
    return ftp.list(dir).then(lst => {
        // console.log(dir, lst.map(l => dir + l.name));
        let dirNames = lst
          .filter(f => f.type == "d" && f.name != ".." && f.name != "." && !preserve.includes(f.name))
          .map(f => path.posix.join(dir, f.name));

        let fnames = lst
          .filter(f => f.type != "d" && !preserve.includes(f.name))
          .map(f => path.posix.join(dir, f.name));

        // delete subdirectories and then all files
        return mapSeries(dirNames, dirName => {
            const preserveAllFilesOnDir = preserve.find(p => p === dirName);
            const preserveDir = preserveAllFilesOnDir || preserve.find(p => p.startsWith(dirName + '/'));
            // deletes everything in subdirectory if not preserved
            if(!preserveAllFilesOnDir) {
                return deleteDir(ftp, dirName, preserve).then(() => {
                    if(!preserveDir) {
                        ftp.rmdir(dirName)
                    }
                });
            }
        }).then(() => mapSeries(fnames, fname => {
            const preserveFile = preserve.find(p => {
                return p === fname
            });
            // delete file if not preserved
            if(!preserveFile) {
                ftp.delete(fname)
            }
        }));
    });
}

mkDirExists = (ftp, dir) => {
    // Make the directory using recursive expand
    return ftp.mkdir(dir, true).catch((err) => {
        if (err.message.startsWith("EEXIST")) {
            return Promise.resolve();
        } else {
            console.log("[mkDirExists]", err.message);
            // console.log(Object.getOwnPropertyNames(err));
            return Promise.reject(err);
        }
    });
};

/**
 * Applies the mapper function to each item in the array in series.
 * @param {Array} array - The array to map over.
 * @param {Function} mapper - The mapping function.
 * @returns {Promise<Array>} A promise that resolves with the new array.
 */
function mapSeries(array, mapper) {
    // Initialize a resolved Promise
    let result = Promise.resolve();
    // Empty array to store the results
    const output = [];

    array.forEach((item, index) => {
        // Chain a new Promise to the result
        result = result.then(() => {
            // Apply the mapper function to the current item
            return mapper(item, index, array)
                .then(res => {
                    output.push(res);
                });
        });
    });

    // Return a Promise that resolves with the output array
    return result.then(() => output);
}

module.exports = {
    checkIncludes: checkIncludes,
    getPassword: getPassword,
    parseLocal: parseLocal,
    canIncludePath: canIncludePath,
    countFiles: countFiles,
    mkDirExists: mkDirExists,
    deleteDir: deleteDir,
    mapSeries: mapSeries,
};
