// works with the test server
const path = require("path");

const FtpDeploy = require("../src/ftp-deploy");

const config = {
    user: "anonymous",
    password: "anon", // Optional, prompted if none given
    host: "localhost",
    port: 2121,
    localRoot: path.join(__dirname, "../test/local"),
    remoteRoot: "/ftp",
    exclude: [],
    include: ["folderA/**/*", 'test-inside-root.txt']
};

const d = new FtpDeploy();
d.deploy(config)
    .then(() => {
        console.log("Done");
    });

// d.deploy(config, function(err) {
//     if (err) {
//         console.log("error", err);
//     } else {
//         console.log("Done :-)")
//     }
// })
