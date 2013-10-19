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
	remoteRoot: "/public_html/remote-folder/"
}
	
ftpDeploy.deploy(config, function(err) {
	if (err) console.log(err)
	else console.log('finished');
});

// if you want to be notified of what ftpDeploy is doing
// listen to some of the events it's emitting
// Want more events? Let me know and I'll add them.
ftpDeploy.on('uploading', function(relativeFilePath) {
	console.log('uploading ' + relativeFilePath);
});
ftpDeploy.on('uploaded', function(relativeFilePath) {
	console.log('uploaded ' + relativeFilePath);
});
```
## Changes in 0.2.0

Starting with 0.2, requiring ftp-deploy returns the FtpDeploy object, and you will need to instantiate is separately on your own.

## Installation

```js
npm install ftp-deploy
```


## License 

MIT
