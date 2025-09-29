#!/usr/bin/env npx tsx

import consoleTable     from 'console.table';
import commandLineArgs  from 'command-line-args';
import objToCsv         from 'objects-to-csv';

import config           from './Config';

const argv = commandLineArgs([
    { name: 'command'       ,alias: 'c', type: String    , defaultValue:'help', defaultOption:true },
    { name: 'projectId'     ,alias: 'p', type: String    , defaultValue: '' },
    { name: 'includeHidden' ,alias: 'i', type: Boolean   , defaultValue: true },
    { name: 'attributeIdns' ,alias: 'a', type: String    , defaultValue: '' },
    { name: 'tableColLength',alias: 't', type: Number    , defaultValue: 0 },
    { name: 'csv'           ,alias: 'v', type: Boolean   , defaultValue: false },
    { name: 'stringify'     ,alias: 's', type: Boolean },
]);

const getCmdPromise = async ( argv:Record<string,any> ) : Promise<() => any> => {
    if( argv.command==='help' )
        return () => {
            console.log(`NEWO CLI
Usage:
    newo pullProjects               # pull all projects and their data
    newo projectStatus              # show modified files
    newo listProjectMetas           # list all accessible project bases
    newo getCustomerProfile         # get customer profile
    newo getProject                 # get project (requires -p)
    newo getCustomerAttrs           # get project attributes
    newo getCustomerAcctLinks       # get members linked to a customer (broken)

Common Flags:
    --stringify, -s                 # send all the output through JSON.stringify (helpful with long outputs)

getProject Flags:
    --projectId, -p                 # project Id

getCustomerAttrs Flags:
    --includeHidden, -i             # include hidden attributes
    --attributeIdns, -a             # optional comma-separated list of attribute IDNs to fetch
    --tableColLength,-t             # default is 0. if >0 then the output is formatted as a table with each column max length
    --csv,-v                        # output as CSV

Env:
    NEWO_API_KEY or NEWO_API_KEYS   # required, comma-separated list of API keys
    LOG_LEVEL                       # optional, default is 0, higher means more verbose logging
    NEWO_BASE_URL                   # optional, default is https://app.newo.ai
    NEWO_PROJECTS_DIR               # optional, where to download the projects to, default is './projects'
    NEWO_STATE_DIR                  # optional, where to keep the projects state at, default is './.newo'
`);
    };
    // No need to remember clients here - they are cached in Customer class
    await Promise.all(config.customers.map( c => {
        return c.getClient()
            .then( client => {
                config.log(2, `✓ Client initialized for customer with API key ending in ...${c.apiKey.slice(-4)}`);
                return client;
            })
            .catch( e => {
                throw Error(`❌ Error initializing client for customer with API key ending in ...${c.apiKey.slice(-4)}: ${e.message}`);
            });
    }));
    config.log(1, `✓ Clients initialized for ${config.customers.length} customer(s)`);
    switch( argv.command ) {
        case 'pullProjects':
            return (() => Promise.all(config.customers.map(c=>c.pullProjects())));
        case 'projectStatus':
            return (() => Promise.all(config.customers.map(c=>c.projectStatus())));
        case 'listProjectMetas':
            return (() => Promise.all(config.customers.map(c=>c.listProjectMetas())))
        case 'getProject':
            return (() => Promise.all(config.customers.map(c=>c.client.getProject(argv.projectId))));
        case 'getCustomerProfile':
            return (() => Promise.all(config.customers.map(c=>c.getCustomerProfile())));
        case 'getCustomerAttrs': {
            const attributeIdns = argv.attributeIdns ? argv.attributeIdns.split(',').map(s=>s.trim()).filter(s=>s.length>0) : [];
            const attributeNdxs = attributeIdns.reduce( (acc,idn,ndx) => {
                acc[idn] = ndx;
                return acc;
            },{} as Record<string,number>);
            return (() => Promise.all(config.customers.map( async ( c ) => {
                const [profile,attrs] = await Promise.all([
                    c.getCustomerProfile(),
                    c.client.getCustomerAttrs(argv.includeHidden).then( attrs => {
                        if( attributeIdns.length>0 ) {
                            const idns = argv.attributeIdns.split(',').map(s=>s.trim()).filter(s=>s.length>0);
                            return attrs.attributes.filter( a => attributeIdns.includes(a.idn) );
                        }
                        return attrs.attributes;
                    })
                ]);
                if( !attributeIdns.length )
                    return attrs;
                // Else do special filtering and formatting
                return {
                    profile : {
                        id      : profile.id,
                        idn     : profile.idn,
                        name    : profile.name,
                        email   : profile.email
                    },
                    attrs : attrs
                        .filter( a => {
                            return attributeIdns.includes(a.idn);
                        })
                        .sort( (a,b) => {
                            // Sort the attributes in the order they were requested
                            return (attributeNdxs[a.idn]||0) - (attributeNdxs[b.idn]||0);
                        })
                        .map( a => {
                            return {
                                idn     : a.idn,
                                value   : a.value,
                            };
                        })
                }
            })).then( (results:({profile:Record<string,any>,attrs:Record<string,any>[]})[]) => {
                const getObjArray = ( colNameGetter:((s:string,colNames:Record<string,any>)=>string) ) => {
                    return results.reduce( (acc,res,ndx) => {
                        const line = res.attrs.reduce( (acc2,attr) => {
                            acc2[colNameGetter(attr.idn,acc2)] = attr.value;
                            return acc2;
                        },{
                            IDN : res.profile.idn,
                        } as Record<string,any>);
                        acc.push(line);
                        return acc;
                    },[] as Record<string,any>[]);
                }
                if( argv.tableColLength>0 )
                    return consoleTable.getTable(getObjArray( (s,colNames)=> {
                        // Truncation of attributes IDNs can create colliding column names
                        s = s.replace(/^project_/,'').replace(/^attributes_/,'').replace(/^setting_/,'').substring(0,argv.tableColLength)
                        while( (s.length>4) && (s in colNames) )
                            s = s.substring(0,s.length-1);
                        return s;
                    }));
                if( argv.csv )
                    return (new objToCsv( getObjArray( s => s ) )).toString();
                return results;
            }));
        }
        case 'getCustomerAcctLinks': {
            return (() => Promise.all(config.customers.map(c=>c.getCustomerAccountLinks())));
        }
    }
    return (() => {
        throw Error(`Unknown command: '${argv.command}'. Use '${process.argv[1]} -c help' for usage.`);
    });
}
const main = async () => {
    return getCmdPromise(argv).then(proc=>proc());
}

main().then( r => {
    if( argv.stringify )
        console.log(JSON.stringify(r,null,4));
    else
        console.log(r);
    process.exit(0);
}).catch(console.error);
