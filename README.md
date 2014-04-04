# ftp-deploy

Ftp a folder from your local disk to a remote ftp destination. Does not delete from destination directory. Derived from [https://github.com/zonak/grunt-ftp-deploy](https://github.com/zonak/grunt-ftp-deploy "zonak/grunt-ftp-deploy").

A Node.js package.


## Usage

The most basic usage (stops uploading when an error occurs):

```js
var FtpDeploy = require('ftp-deploy');
var ftpDeploy = new FtpDeploy();

var config = {
	username: "username",
	password: "password", // optional, prompted if none given
	host: "ftp.someserver.com",
	port: 21,
	localRoot: __dirname + "/local-folder",
	remoteRoot: "/public_html/remote-folder/",
	exclude: ['.git', '.idea', 'tmp/*']
}
	
ftpDeploy.deploy(config, function(err) {
	if (err) console.log(err)
	else console.log('finished');
});
```

To be notified of what ftpDeploy is doing:

```
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

To continue uploading files even if a file upload fails: 

```
config.continueOnError = true;

ftpDeploy.deploy(config, function(err) {
	if (err) console.log(err) // error authenticating or creating/traversing directory
	else console.log('finished');
});

ftpDeploy.on('upload-error', function (data) {
	console.log(data.err); // data will also include filename, relativePath, and other goodies
});
```


## Changes

- 0.6.x
    - added optional ```continueOnError``` config. When set to true, ftp-deploy continues to upload files after a failed put. When not specified or set to false, the ```.deploy()``` callback is called immediately after a failed put.
    - added ```upload-error``` event
    - removed ```stopOnError``` config setting in preference of ```continueOnError```

- 0.5.x
	- upgraded jsftp from 0.6.x to 1.2.x
	- Added ```stopOnError``` to configuration.
	- added ```error``` event. 
	- deprecated paralleluploads config setting (no longer supported by jsftp)

- 0.4.x
    - uploading and uploaded events emit data instead of a relative file path.

- 0.3.x
	- New config setting ```exclude``` can be used to exclude folders/files from the ftp deploy process

- 0.2.x
    - Requiring ftp-deploy returns the FtpDeploy object, and you will need to instantiate is separately on your own.
    - New config setting ```paralleluploads```: sets number of  parallelUploads (within a specific folder)
    - ftpDeploy instance has properties ```transferred``` and ```total```. Useful for determining progress based on file count.


## Installation

```js
npm install ftp-deploy
```


## License 

MIT
