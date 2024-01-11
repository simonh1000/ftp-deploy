import PromiseFtp from "promise-ftp";
import PromiseSftp from "ssh2-sftp-client";
export interface FtpDeployConfig {
    remoteRoot: string;
    localRoot: string;
    host: string;
    include: string[];
    user: string;
    port: number;
    continueOnError?: boolean;
    deleteRemote?: boolean;
    exclude?: string[];
    sftp?: boolean;
    password?: string;
}

export type FileMap = Record<string, string[]>;

export type Ftp = PromiseFtp | PromiseSftp;

export interface EventObject {
    totalFilesCount: number;
    transferredFileCount: number;
    filename: string;
    error?: Error;
}
