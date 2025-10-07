import fs       from 'node:fs';


export const getStats = ( path:string ) => {
    // Doesn't really have to me a method of this class, but whatever
    try {
        return fs.statSync(path);
    }
    catch( err ) {
        return undefined;
    }
}

export const enforceDirectory = ( path:string ) => {
    if( !getStats(path)?.isDirectory() )
        fs.mkdirSync(path,{ recursive:true });
    return path; // helpful
}

