const fs = require("fs");
const path = require("path");
const util = require("util");
const Promise = require("bluebird");

const read = require("read");
const readP = util.promisify(read);

const minimatch = require("minimatch");

const jsonDiff = require("json-diff");


// P H A S E  0

function checkIncludes(config) {
    config.excludes = config.excludes || [];
    if ((!config.include || !config.include.length) && (!config.deleteRemote && !config.fileFolderHashSums && (config.fileFolderHashSums == '' ))) {
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
    let handleItem = function(acc, item) {
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

function parseDeletes(deletes, remoteRootDir, incrementalUpdate) {
    const res = [];
    deletes = deletes || [];
    deletes.forEach(function(item) {
        res.push(item.slice(-1) == '/' ? item.slice(0,-1) : item);
    });
    if ((res.length == 0) && !incrementalUpdate) {
      res.push('/');
    }
    return res;
}

function countFiles(filemap) {
    return Object.values(filemap).reduce((acc, item) => acc.concat(item))
        .length;
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

// re-engineer content from folder-hash to object
function fh_folder_hash_to_obj(content) {
  let content_json = String(content).
        replace(/\'/g, '"').
        replace(/\" \}$/gm, '" },').
        replace(/\},\s*\]/gm, '} ]').
        replace(/\}\s*\{/gm, '}, {').
        replace(/name:/g, '"name":').
        replace(/hash:/g, '"hash":').
        replace(/children:/g, '"children":');
  return JSON.parse(content_json);
}

// read a file generated from folder-hash and re-egineer to object
function fh_read_folder_hash(filename) {
  let content = fs.readFileSync(filename);
  return fh_folder_hash_to_obj(content);
}

// rebuild a parent / children structured list from folder-hash
// to a flat path / filename list with hash
function fh_make_folder_list(obj, path, items) {
  items.forEach(function(elem) {
     path_and_name = path + (path != '' ? '/' : '') + elem.name;
     obj.push({ hash: elem.hash, name: path_and_name + (elem.children ? '/' : '') });
     if (elem.children) { fh_make_folder_list(obj, path_and_name, elem.children); }
  });
  return obj;
}

// get the filename (not path) for a hash from a flat list
function fh_get_changed_filename_for_hash(hash_list, search_hash) {
  // set a default
  let result = ''
  // iterate over list
  hash_list.forEach(function(item) {
    // check for searched hash
    if (item.hash == search_hash) {
      // return the filename if it is not a path
      result = (item.name.slice(-1) != '/') ? item.name : '';
      // stop immediately this iteration
      return;
    }
  });
  // return what and if found
  return result;
}

// drop all empty entries and if optimize for delete
// remove all subfiles when a folder is deleted, in case
// of NOT for delete, drop any path to upload just filenames
function fh_optimize_filelist(filelist, flag_optimize_for_delete) {
  // optimize delete list if
  let i = 0;
  let rm_path = '';
  while (i < filelist.length) {
    if (filelist[i] == '') {
      filelist.splice(i, 1);
    }
    else
    if (filelist[i].slice(-1) == '/') {
      if (flag_optimize_for_delete) {
        rm_path = filelist[i];
        i++;
      } else {
        filelist.splice(i, 1);
      }
    }
    else
    if ((rm_path != '') && filelist[i].startsWith(rm_path)) {
      filelist.splice(i, 1);
    }
    else {
      rm_path = '';
      i++;
    }
  }
  // return the changed array
  return filelist;
}

// use jsonDiff and extract the filenames which are changed
function fh_get_diff_filelist(hashlist_a, hashlist_b) {
  let diff = jsonDiff.diff(hashlist_a, hashlist_b) || [];
  let result = [];
  diff.forEach(function(elem) {
    if (elem[0] == '-') {
      result.push(elem[1].name)
    } else
    if (elem[0] == '~') {
      result.push(fh_get_changed_filename_for_hash(hashlist_a, elem[1].hash.__old));
    }
  });

  return result;
}

// prepare the list to delete on ftp and to upload
function fh_get_ftp_filelists(fileFolderHashSums, hashes_on_ftp, hashes_in_site) {

  result = {
    delete: fh_optimize_filelist(fh_get_diff_filelist(hashes_on_ftp, hashes_in_site), true),
    upload: fh_optimize_filelist(fh_get_diff_filelist(hashes_in_site, hashes_on_ftp), false)
  }
  // append ourself if any changes
  if ((result.delete.length > 0) || (result.upload.length > 0)) {
    result.delete.splice(0, 0, fileFolderHashSums)
    result.upload.push(fileFolderHashSums)
  }

  // console.log('\n\n-- DIFF RESULT -------------------\n\n');
  // console.log(result);
  // console.log('\n\n---------------------\n\n');

  // return result
  return result;
}

function getFolderHashSumsDiffs(fileFolderHashSums, localRoot, ftp_content) {
    let res = null;
    const fname = path.join(localRoot, fileFolderHashSums)
    if (fs.existsSync(fname)) {
        res = fh_get_ftp_filelists(
                  fileFolderHashSums,
                  fh_make_folder_list([], '', fh_folder_hash_to_obj(ftp_content).children),
                  fh_make_folder_list([], '', fh_read_folder_hash(fname).children)
              );
    } else {
      throw new Error("Cannot state the local file: " + fileFolderHashSums + " - fallback to full update!");
    }

    // return the prepared diff lists
    return res;
}

module.exports = {
    checkIncludes: checkIncludes,
    getPassword: getPassword,
    parseLocal: parseLocal,
    parseDeletes: parseDeletes,
    canIncludePath: canIncludePath,
    countFiles: countFiles,
    mkDirExists: mkDirExists,
    getFolderHashSumsDiffs: getFolderHashSumsDiffs
};
