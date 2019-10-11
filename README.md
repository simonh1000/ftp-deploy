# ftp-deploy

A Node.js package to help with deploying code. Ftp a folder from your local disk to a remote ftp destination. Does not delete from destination directory.

Version 2.0.0 is an almost complete re-write to use promises and [promise-ftp](https://github.com/realtymaps/promise-ftp) instead of jsftp. The one breaking change is listed in the notes of Usage section.

## Installation

```js
npm install --save-dev ftp-deploy
```

## Usage

The most basic usage:
```js
var FtpDeploy = require("ftp-deploy");
var ftpDeploy = new FtpDeploy();

var config = {
    user: "user",
    // Password optional, prompted if none given
    password: "password",
    host: "ftp.someserver.com",
    port: 21,
    localRoot: __dirname + "/local-folder",
    remoteRoot: "/public_html/remote-folder/",
    // include: ["*", "**/*"],      // this would upload everything except dot files
    include: ["*.php", "dist/*", ".*"],
    // e.g. exclude sourcemaps, and ALL files in node_modules (including dot files)
    exclude: ["dist/**/*.map", "node_modules/**", "node_modules/**/.*", ".git/**"],
    // delete ALL existing files at destination before uploading, if true
    deleteRemote: false,
    // Passive mode is forced (EPSV command is not sent)
    forcePasv: true
};

// use with promises
ftpDeploy
    .deploy(config)
    .then(res => console.log("finished:", res))
    .catch(err => console.log(err));

// use with callback
ftpDeploy.deploy(config, function(err, res) {
    if (err) console.log(err);
    else console.log("finished:", res);
});
```

**Note:** 
 - in version 2 the config file expects a field of `user` rather than `username` in 1.x.
 - The config file is passed as-is to Promise-FTP.
 - I create a file - e.g. deploy.js - in the root of my source code and add a script to its `package.json` so that I can `npm run deploy`.

```json
"scripts": {
    "deploy": "node deploy"
},
```

## Configuration include and exclude

These are lists of [minimatch globs](https://github.com/isaacs/minimatch). ftp-deploy works by checking for each file in your sourece directory, whether it is included by one of the include patterns and whether it is NOT excluded by one of the exclude patterns. In other words:

-   `include`: all files that match will be uploaded. **Note** that a `[ ]` matches nothing
-   `exclude`: if a file matches the include pattern a subset may nonetheless be excluded

## Events

ftp-deploy reports to clients using events. To get the output you need to  implement watchers for "uploading", "uploaded" and "log":

```js
ftpDeploy.on("uploading", function(data) {
    console.log(data.totalFilesCount); // total file count being transferred
    console.log(data.transferredFileCount); // number of files transferred
    console.log(data.filename); // partial path with filename being uploaded
});
ftpDeploy.on("uploaded", function(data) {
    console.log(data); // same data as uploading event
});
ftpDeploy.on("log", function(data) {
    console.log(data); // same data as uploading event
});
ftpDeploy.on("upload-error", function(data) {
    console.log(data.err); // data will also include filename, relativePath, and other goodies
});
```

## Testing

A script to run a simple ftp server (using [ftp-srv](https://github.com/trs/ftp-srv)) is included, together with a test directory.

To use open a console to run the ftp server:

```
npm run server
```

and then in another console run the tests:

```
npm test
```

## ToDo

 - re-enable continueOnError
 - update newer files only (PR welcome)
 
