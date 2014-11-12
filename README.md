# ftp-deploy

Ftp a folder from your local disk to a remote ftp destination. Does not delete from destination directory.

A Node.js package.

(Need sftp? Check out [sftp-upload](https://github.com/pirumpi/sftp-upload))


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
    data.filename;             // partial path with filename being uploaded
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



## Installation

```js
npm install ftp-deploy
```



## License 

MIT
