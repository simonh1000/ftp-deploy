const fs = require("fs");
const path = require("path");
const util = require("util");
const Promise = require("bluebird");

const read = require("read");
const readP = util.promisify(read);

const minimatch = require("minimatch");

// P H A S E  0

function checkIncludes(config) {
    config.excludes = config.excludes || [];
    if (!config.include || !config.include.length) {
        return Promise.reject({
            code: "NoIncludes",
            message: "You need to specify files to upload - e.g. ['*', '**/*']"
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
            silent: true
        };
        return readP(options).then(res => {
            let config2 = Object.assign(config, { password: res });
            return config2;
        });
    }
}

// Analysing local firstory

/**
 * Determines if the `filePath` matches any of the `includes` patterns
 * and none of the `excludes` patterns.
 * 
 * Files beginning with a dot have to be explicitly included.
 * 
 * @param {(string|RegExp)[]} includes
 * @param {(string|RegExp)[]} excludes 
 * @param {string} filePath 
 * @returns {boolean}
 */
function canIncludePath(includes, excludes, filePath) {
    let canInclude = includes.some(
        (pattern) => pattern instanceof RegExp
            ? pattern.test(filePath)
            : minimatch(filePath, pattern, { matchBase: true })
    );

    // Now check whether the file should in fact be specifically excluded
    if (canInclude && excludes) {
        // if any excludes match return false
        canInclude = excludes.every(
            (pattern) => pattern instanceof RegExp
                ? !pattern.test(filePath)
                // Excluding dot files if they match the pattern implicitly
                : !minimatch(filePath, pattern, { matchBase: true, dot: true })
        );
    }

    return canInclude;
}

/**
 * A method for parsing the source location and storing the
 * information into a suitably formatted object.
 * @param {(string|RegExp)[]} includes
 * @param {(string|RegExp)[]} excludes
 * @param {string} localRootDir
 * @param {string} relDir
 */
function parseLocal(includes, excludes, localRootDir, relDir) {
    const fullDir = path.join(localRootDir, relDir);
    // Check if `fullDir` is a valid location
    if (!fs.existsSync(fullDir)) {
        throw new Error(`${fullDir} is not an existing location`);
    }

    // Iterate through the contents of the `fullDir` of the current iteration
    const files = fs.readdirSync(fullDir);
    
    return files.reduce(function(acc, item) {
        const currItem = path.join(fullDir, item);
        const newRelDir = path.relative(localRootDir, currItem);

        if (fs.lstatSync(currItem).isDirectory()) {
            // currItem is a directory. Recurse and attach to accumulator
            const tmp = parseLocal(includes, excludes, localRootDir, newRelDir);
            for (let key in tmp) {
                if (tmp[key].length == 0) {
                    delete tmp[key];
                }
            }

            return {
                ...acc,
                ...tmp,
            };
        } else {
            // currItem is a file
            // acc[relDir] is always created at previous iteration
            if (canIncludePath(includes, excludes, newRelDir)) {
                acc[relDir].push(item);
                return acc;
            }
        }
        return acc;
    }, {[relDir]: []});
}

function countFiles(filemap) {
    return Object.values(filemap).reduce((acc, item) => acc.concat(item))
        .length;
}

function deleteDir(ftp, dir) {
    return ftp.list(dir).then(lst => {
        let dirNames = lst
            .filter(f => f.type == "d" && f.name != ".." && f.name != ".")
            .map(f => path.posix.join(dir, f.name));

        let fnames = lst
            .filter(f => f.type != "d")
            .map(f => path.posix.join(dir, f.name));

        // delete sub-directories and then all files
        return Promise.mapSeries(dirNames, dirName => {
            // deletes everything in sub-directory, and then itself
            return deleteDir(ftp, dirName).then(() => ftp.rmdir(dirName));
        }).then(() => Promise.mapSeries(fnames, fname => ftp.delete(fname)));
    });
}

mkDirExists = (ftp, dir) => {
    // Make the directory using recursive expand
    return ftp.mkdir(dir, true).catch(err => {
        if (err.message.startsWith("EEXIST")) {
            return Promise.resolve();
        } else {
            console.log("[mkDirExists]", err.message);
            // console.log(Object.getOwnPropertyNames(err));
            return Promise.reject(err);
        }
    });
};

module.exports = {
    checkIncludes: checkIncludes,
    getPassword: getPassword,
    parseLocal: parseLocal,
    canIncludePath: canIncludePath,
    countFiles: countFiles,
    mkDirExists: mkDirExists,
    deleteDir: deleteDir
};
