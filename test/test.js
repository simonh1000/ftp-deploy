const path = require('path');
const FtpDeploy = require('../ftp-deploy.js');

const ftpDeploy = new FtpDeploy();

const config = {
	username: 'rickbergfalk',
	password: '', // Optional, prompted if none given
	host: 'localhost',
	port: 21,
	localRoot: path.join(__dirname, 'test-root'),
	remoteRoot: '/Users/rickbergfalk/Public/',
	exclude: ['.git', '.idea', 'tmp/*']
};

ftpDeploy.on('uploaded', data => {
	console.log('uploaded:');
	console.log(data);
});

ftpDeploy.on('uploading', data => {
	console.log('uploading');
	console.log(data);
});

ftpDeploy.deploy(config, err => {
	if (err) {
		console.log(err);
	}	else {
		console.log('finished');
	}
});
