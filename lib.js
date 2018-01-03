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

module.exports = {
    has: has,
    canIncludeFile: canIncludeFile
}