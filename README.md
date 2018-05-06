# ftp-deploy

A Node.js package to help with deploying code. Ftp a folder from your local disk to a remote ftp destination. Does not delete from destination directory.

Version 2.0.0 is an almost complete re-write to use promises and to move away from jsftp to [ftp-srv](https://github.com/trs/ftp-srv). The one breaking change is listed in the Usage section.

## Installation

```js
npm install --save-dev ftp-deploy
```

## Usage

I create a file - e.g. deploy.js - in the root of my source code and add a script to its package.json so that I can `npm run deploy`.

**Note:** that in version 2 the config file expects a field of `user` rahter than `username` in 1.x.

```json
  "scripts": {
    "deploy": "node deploy"
  },
```

The most basic usage (stops uploading when an error occurs):

```js
var FtpDeploy = require('ftp-deploy');
var ftpDeploy = new FtpDeploy();

var config = {
	user: "user",
	password: "password", // optional, prompted if none given
	host: "ftp.someserver.com",
	port: 21,
	localRoot: __dirname + '/local-folder',
	remoteRoot: '/public_html/remote-folder/',
	include: ['*.php', 'dist/*'],
	exclude: ['dist/**/*.map']   // e.g. exclude sourcemaps
}
	
ftpDeploy.deploy(config, function(err) {
	if (err) console.log(err)
	else console.log('finished');
});
```

## Configuration

 * `include`: all files that match will be uploaded. Note that a `[ ]` matches nothing
 * `exclude`: if a file matches the include pattern it may nonetheless be excluded

## Events

To be notified of what ftpDeploy is doing:

```js
ftpDeploy.on('uploading', function(data) {
    data.totalFileCount;       // total file count being transferred
    data.transferredFileCount; // number of files transferred
    data.percentComplete;      // percent as a number 1 - 100
    data.filename;             // partial path with filename being uploaded
});
ftpDeploy.on('uploaded', function(data) {
	console.log(data);         // same data as uploading event
});
```

To continue uploading files even if a file upload fails (not implemented at present): 

```js
ftpDeploy.on('upload-error', function (data) {
	console.log(data.err); // data will also include filename, relativePath, and other goodies
});
```
## Testing 

A script to run a simple ftp server is included at `npm run test_server` and this is needed to run the main tests as `npm test`.

## ToDo
 
re-enable continueOnError