# Changelog

## 2.3.3
    - If delete does not work, try to continue anyway
    
## 2.3.2
    - Requre node 8.0
    
## 2.3.1
    - Fix a bug some experienced uploaded to "/"
    
## 2.3.0
    - Return result of process at end of run

## 2.2.1
    - Bugfix: transfered file count
    
## 2.2.0
    - remove console logs in favour of 'log' events

## 2.1.1
    - AFix a bug for windows users

## 2.1.0
    - Add delete destination before commencing uploads

## 2.0.0
    - complete rewrite using promises
    - switch from jsftp to ftp-srv
    - breaks continueOnError
    - config must now include an include field with non-empty value. E.g. use ['*', '**/*'] for all files
    - format using prettier
    - adds tests

## 1.2.0
    - Adds an optional config.include which supersedes any exclusion rules.
    - Linting code cleanup via xo style/tool

## 1.1.0
    - Updated dependencies

## 1.0.0

    - refactored for (hopefully) easier to understand code
    - brought jsftp to 1.3.x, async to 0.9.x
    - removed relative path from uploading/uploaded event data. (filename contains file name and partial path)

## 0.7.0

    - added prompting user for FTP password if none given in config

## 0.6.0

    - added optional ```continueOnError``` config. When set to true, ftp-deploy continues to upload files after a failed put. When not specified or set to false, the ```.deploy()``` callback is called immediately after a failed put.
    - added ```upload-error``` event
    - removed ```stopOnError``` config setting in preference of ```continueOnError```

## 0.5.0

    - upgraded jsftp from 0.6.x to 1.2.x
    - Added ```stopOnError``` to configuration.
    - added ```error``` event. 
    - deprecated paralleluploads config setting (no longer supported by jsftp)

## 0.4.0

    - uploading and uploaded events emit data instead of a relative file path.

## 0.3.0

    - New config setting ```exclude``` can be used to exclude folders/files from the ftp deploy process

## 0.2.0

    - Requiring ftp-deploy returns the FtpDeploy object, and you will need to instantiate is separately on your own.
    - New config setting ```paralleluploads```: sets number of  parallelUploads (within a specific folder)
    - ftpDeploy instance has properties ```transferred``` and ```total```. Useful for determining progress based on file count.