import util     from 'node:util';
import path     from 'node:path';
import dayjs    from 'dayjs';

import dotenv   from 'dotenv';

export default class Cli {

    log_level       : number;
    base_url        : string;
    project_id?     : string;
    state_dir       : string;
    tokens_path     : string;

    // auth
    api_key         : string;
    access_token    : string;
    refresh_token   : string;
    refresh_url     : string;

    constructor( ) {
        dotenv.config();
        this.log_level      = process.env.NEWO_LOG_LEVEL ? parseInt(process.env.NEWO_LOG_LEVEL) : 1;
        this.base_url       = process.env.NEWO_BASE_URL;
        this.api_key        = process.env.NEWO_API_KEY;
        this.access_token   = process.env.NEWO_ACCESS_TOKEN;
        this.refresh_token  = process.env.NEWO_REFRESH_TOKEN;
        this.refresh_url    = process.env.NEWO_REFRESH_URL;
        this.project_id     = process.env.NEWO_PROJECT_ID;
        this.state_dir      = path.join(process.env.NEWO_STATE_DIR||process.cwd(),'.newo');
        this.tokens_path    = path.join(process.env.TOKENS_PATH||this.state_dir,'tokens.json');
    }
    get nowstr() : string {
        return dayjs().format("YYYY-MM-DD HH:mm:ss");
    }
    log( level:number, ...args:any[] ) {
        if( this.log_level >= level ) {
            // tslint:disable:no-console
            console.log(1,`${this.nowstr}:${level}: ` + util.format(...args));
        }
    }
};
