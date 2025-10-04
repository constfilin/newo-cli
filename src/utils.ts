import fs       from 'node:fs';
import util     from 'node:util';
import dayjs    from 'dayjs';


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

export const log = ( ...args:any ) => {
    process.stderr.write(`${dayjs().format("YYYY-MM-DD HH:mm:ss")}: `+util.format(...args)+'\n');
}

export const sortIfArray = <T extends {}>( r:T[], sortColumn:string, sortDirection:number ) : T[]=> {
    if( !Array.isArray(r) )
        return r;
    if( !sortColumn )
        return r;
    return r.sort( (a,b) => {
        const left = a[sortColumn];
        const right = b[sortColumn];
        if( typeof left === 'number' && typeof right === 'number' )
            return (left-right)*sortDirection;
        return String(left).localeCompare(String(right))*sortDirection;
    });
}
