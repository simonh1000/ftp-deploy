# ftp-deploy

Ftp a folder from your local disk to a remote ftp destination. Does not delete from destination directory. Derived from [https://github.com/zonak/grunt-ftp-deploy](https://github.com/zonak/grunt-ftp-deploy "zonak/grunt-ftp-deploy").

A Node.js package.


## Usage

```js
var FtpDeploy = require('ftp-deploy');
var ftpDeploy = new FtpDeploy();

var config = {
	username: "username",
	password: "password",
	host: "ftp.someserver.com",
	port: 21,
	localRoot: __dirname + "/local-folder",
	remoteRoot: "/public_html/remote-folder/",
	parallelUploads: 10,
	exclude: ['.git', '.idea', 'tmp/*']
}
	
ftpDeploy.deploy(config, function(err) {
	if (err) console.log(err)
	else console.log('finished');
});

// to be notified of what ftpDeploy is doing
ftpDeploy.on('uploading', function(data) {
    data.totalFileCount;       // total file count being transferred
    data.transferredFileCount; // number of files transferred
    data.percentComplete;      // percent as a number 1 - 100
    data.filename;             // filename being uploaded
    data.relativePath;         // relative path to file being uploaded from local root location
});
ftpDeploy.on('uploaded', function(data) {
	console.log(data);         // same data as uploading event
});
```


## Changes

- 0.4.x
    - uploading and uploaded events emit data instead of a relative file path.

- 0.3.x
	- New config setting **exclude** can be used to exclude folders/files from the ftp deploy process

- 0.2.x
    - Requiring ftp-deploy returns the FtpDeploy object, and you will need to instantiate is separately on your own.
    - New config setting **paralleluploads**: sets number of  parallelUploads (within a specific folder)
    - ftpDeploy instance has properties **transferred** and **total**. Useful for determining progress based on file count.


## Installation

```js
npm install ftp-deploy
```


## License 

MIT
