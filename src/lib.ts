import fs from "fs";
import path from "path";
import util from "util";
import Promise from "bluebird";
import read from "read";
import { minimatch } from "minimatch";
import { FileMap, Ftp, FtpDeployConfig } from "./types";

const readP = util.promisify(read);

// P H A S E  0

function checkIncludes(config: FtpDeployConfig) {
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

function getPassword(config: FtpDeployConfig) {
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

function canIncludePath(
    includes: string[],
    excludes: string[],
    filePath: string
) {
    let go = (acc: boolean, item: string) =>
        acc || minimatch(filePath, item, { matchBase: true });
    let canInclude = includes.reduce(go, false);

    // Now check whether the file should in fact be specifically excluded
    if (canInclude) {
        // if any excludes match return false
        if (excludes) {
            let go2 = (acc: boolean, item: string) =>
                acc && !minimatch(filePath, item, { matchBase: true });
            canInclude = excludes.reduce(go2, true);
        }
    }

    return canInclude;
}

// A method for parsing the source location and storing the information into a suitably formated object
function parseLocal(
    includes: string[],
    excludes: string[],
    localRootDir: string,
    relDir: string
) {
    // reducer
    const handleItem = function (acc: FileMap, item: string) {
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
            const newAcc: FileMap = Object.assign(acc, tmp);
            return newAcc;
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
    let acc: FileMap = {};
    acc[relDir] = [];
    const res = files.reduce(handleItem, acc);
    return res;
}

function countFiles(filemap: FileMap) {
    return Object.values(filemap).reduce((acc, item) => acc.concat(item))
        .length;
}

function deleteDir(ftp: Ftp, dir: string) {
    return ftp.list(dir).then((lst) => {
        let dirNames = lst
            .filter((f) => f.type == "d" && f.name != ".." && f.name != ".")
            .map((f) => path.posix.join(dir, f.name));

        let fnames = lst
            .filter((f) => f.type != "d")
            .map((f) => path.posix.join(dir, f.name));

        // delete sub-directories and then all files
        return Promise.mapSeries(dirNames, (dirName) => {
            // deletes everything in sub-directory, and then itself
            return deleteDir(ftp, dirName).then(() => ftp.rmdir(dirName));
        }).then(() => Promise.mapSeries(fnames, (fname) => ftp.delete(fname)));
    });
}

function mkDirExists(ftp: Ftp, dir: string) {
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
}

module.exports = {
    checkIncludes: checkIncludes,
    getPassword: getPassword,
    parseLocal: parseLocal,
    canIncludePath: canIncludePath,
    countFiles: countFiles,
    mkDirExists: mkDirExists,
    deleteDir: deleteDir,
};
